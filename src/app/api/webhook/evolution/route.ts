import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { processLeadWithSkills } from '@/lib/openai';
import { routeLead } from '@/lib/router';
import { sendTextMessage } from '@/lib/evolution-api';
import { describeImage, transcribeAudio } from '@/lib/multimodal';

const processedMessageIds = new Set<string>();

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const messageData = body.data?.messages?.[0] || body.data;
    const remoteJid = messageData?.key?.remoteJid || messageData?.remoteJid || body.data?.key?.remoteJid || body.sender;
    const messageId = messageData?.key?.id || messageData?.id;
    const pushName: string | null = messageData?.pushName || body.data?.pushName || null;

    if (body.event === 'messages.upsert' || body.event === 'MESSAGES_UPSERT') {
      if (!messageData) return NextResponse.json({ status: 'ignored', reason: 'no_data' });

      if (messageId) {
        if (processedMessageIds.has(messageId)) {
          return NextResponse.json({ status: 'ignored', reason: 'duplicate_retry' });
        }
        processedMessageIds.add(messageId);
        if (processedMessageIds.size > 1000) processedMessageIds.clear();
      }

      const fromMe = messageData.key?.fromMe;

      // 1. Intervenção Humana
      if (fromMe) {
        const { data: leadToPause } = await supabase.from('leads').select('id').eq('whatsapp_number', remoteJid).single();
        if (leadToPause) {
          await supabase.from('leads').update({ bot_active: false }).eq('id', leadToPause.id);
        }
        return NextResponse.json({ status: 'success', reason: 'human_intervention' });
      }

      if (!remoteJid) return NextResponse.json({ status: 'ignored', reason: 'no_remoteJid' });

      // 1.5 Ignorar se for funcionário interno
      const senderPhone = remoteJid.replace(/\D/g, '');
      const { data: internalUser } = await supabase
        .from('admin_users')
        .select('id, name')
        .or(`whatsapp_number.ilike.%${senderPhone}%,whatsapp_number.ilike.%${senderPhone.substring(2)}%`)
        .limit(1)
        .maybeSingle();

      if (internalUser) {
        return NextResponse.json({ status: 'ignored', reason: 'sender_is_internal_user', name: internalUser.name });
      }

      // 2. Extração de Mensagem
      const messageObj = messageData.message || messageData;
      let messageContent = messageObj?.conversation || 
                           messageObj?.extendedTextMessage?.text || 
                           messageObj?.text ||
                           messageData?.text ||
                           messageObj?.imageMessage?.caption ||
                           messageObj?.videoMessage?.caption ||
                           messageObj?.documentMessage?.caption ||
                           '';

      const { data: globalConfig } = await supabase.from('tenant_config').select('*').limit(1).single();
      if (globalConfig?.bot_active === false) return NextResponse.json({ status: 'ignored', reason: 'GLOBAL_BOT_OFF' });

      // 3. Buscar ou Criar Lead
      let { data: lead } = await supabase.from('leads').select('*').eq('whatsapp_number', remoteJid).single();

      if (!lead) {
        const { data: newLead, error: insertError } = await supabase.from('leads').insert([{ 
          whatsapp_number: remoteJid, 
          name: pushName || null,
          status: 'SDR_QUALIFICATION', 
          bot_active: true
        }]).select().single();
        
        if (insertError) {
          return NextResponse.json({ status: 'error', reason: 'LEAD_INSERT_FAILED', detail: insertError });
        }
        lead = newLead;
      } else if (!lead.name && pushName) {
        await supabase.from('leads').update({ name: pushName }).eq('id', lead.id);
        lead.name = pushName;
      }

      if (!lead) return NextResponse.json({ status: 'error', reason: 'LEAD_NOT_FOUND' });
      if (!lead.bot_active) return NextResponse.json({ status: 'ignored', reason: 'LEAD_BOT_PAUSED' });

      // 4. Suporte Multimodal
      const openaiKey = globalConfig?.openai_key;
      const messageType = messageData.messageType || Object.keys(messageObj || {}).find(k => k.endsWith('Message')) || '';

      try {
        let mediaBase64 = body.data?.base64 || messageData.base64 || null;
        if (messageType === 'imageMessage' && openaiKey && globalConfig) {
          const visionDescription = await describeImage(globalConfig.evolution_url, globalConfig.evolution_instance_name, globalConfig.evolution_key, messageId, remoteJid, openaiKey, messageContent, mediaBase64);
          messageContent = `[IMAGEM RECEBIDA: ${visionDescription}] ${messageContent}`;
        } else if (messageType === 'audioMessage' && openaiKey && globalConfig) {
          const audioText = await transcribeAudio(globalConfig.evolution_url, globalConfig.evolution_instance_name, globalConfig.evolution_key, messageId, remoteJid, openaiKey, mediaBase64);
          messageContent = `[ÁUDIO RECEBIDO: ${audioText}] ${messageContent}`;
        }
      } catch (mediaError) {
        console.error('[Media Error]', mediaError);
      }

      const finalContent = messageContent || '';

      // 5. Buffer rápido (debounce de 1.5s)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 6. Salvar Mensagem do Cliente no Histórico
      await supabase.from('interactions').insert([{ lead_id: lead.id, sender_type: 'lead', message_content: finalContent }]);

      // 7. Processar SDR com Novo Motor
      if (lead.status === 'SDR_QUALIFICATION' || lead.status === 'novo' || lead.status === 'qualificando') {
        const { data: historyData } = await supabase
          .from('interactions')
          .select('sender_type, message_content')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: false })
          .limit(10);

        const history = (historyData || []).reverse();

        const aiResult = await processLeadWithSkills(history, lead.id);

        if (aiResult && !aiResult.erro_openai) {
          const resposta_whatsapp = aiResult.resposta_whatsapp;

          // Atualizar Lead com dados extraídos
          const leadUpdate: any = { updated_at: new Date().toISOString() };
          if (aiResult.cliente?.nome) leadUpdate.name = aiResult.cliente.nome;
          if (aiResult.cliente?.empresa) leadUpdate.company = aiResult.cliente.empresa;
          if (aiResult.cliente?.cnpj) leadUpdate.cnpj = aiResult.cliente.cnpj;
          if (aiResult.cliente?.email) leadUpdate.email_corporativo = aiResult.cliente.email;
          if (aiResult.demanda?.produto_normalizado) leadUpdate.detected_product = aiResult.demanda.produto_normalizado;
          if (aiResult.demanda?.quantidade_metragem) leadUpdate.quantidade = aiResult.demanda.quantidade_metragem;

          // Se qualificação estiver concluída
          if (aiResult.qualificacao_concluida) {
            leadUpdate.status = 'WAITING_SELLER';
          }

          await supabase.from('leads').update(leadUpdate).eq('id', lead.id);

          // Salvar resposta do bot no histórico
          await supabase.from('interactions').insert([{ lead_id: lead.id, sender_type: 'sdr_ai', message_content: resposta_whatsapp }]);

          // Enviar resposta no WhatsApp via Evolution API
          if (globalConfig?.evolution_url && globalConfig?.evolution_key) {
            await sendTextMessage(
              globalConfig.evolution_instance_name || 'linooficial',
              globalConfig.evolution_url,
              globalConfig.evolution_key,
              remoteJid,
              resposta_whatsapp
            );
          }

          // Se concluiu, executar roleta de roteamento
          if (aiResult.qualificacao_concluida) {
            const rawPhone = remoteJid.replace(/\D/g, '');
            const ddd = rawPhone.length >= 12 && rawPhone.startsWith('55') ? rawPhone.substring(2, 4) : '';
            await routeLead(lead.id, lead.tenant_id || globalConfig?.tenant_id || '', {
              produto: leadUpdate.detected_product || lead.detected_product,
              quantidade: leadUpdate.quantidade || lead.quantidade,
              nome_cliente: leadUpdate.name || lead.name,
              empresa: leadUpdate.company || lead.company,
              cnpj: leadUpdate.cnpj || lead.cnpj,
              email: leadUpdate.email_corporativo || lead.email_corporativo,
              ddd
            });
          }

          return NextResponse.json({ status: 'success', action: 'sdr_responded' });
        }
      }

      return NextResponse.json({ status: 'success', action: 'processed' });
    }

    return NextResponse.json({ status: 'ignored', reason: 'not_messages_upsert' });
  } catch (error: any) {
    console.error('[Webhook Error]', error);
    return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
  }
}
