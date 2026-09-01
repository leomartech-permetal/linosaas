import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { processLeadWithSkills, generateSupportResponse } from '@/lib/openai';
import { processPostSaleMessage } from '@/lib/postsale';
import { classifyReturnIntent } from '@/lib/intent-classifier';
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

      // 1. Intervenção Humana (Vendedor assumiu)
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

      // 3. Suporte Multimodal (Imagens e Áudios)
      const openaiKey = globalConfig?.openai_key;
      const messageType = messageData.messageType || Object.keys(messageObj || {}).find(k => k.endsWith('Message')) || '';

      try {
        let mediaBase64 = body.data?.base64 || messageData.base64 || null;
        if (messageType === 'imageMessage' && openaiKey && globalConfig) {
          const visionDescription = await describeImage(
            globalConfig.evolution_url, 
            globalConfig.evolution_instance_name, 
            globalConfig.evolution_key, 
            messageId, 
            remoteJid, 
            openaiKey, 
            messageContent, 
            mediaBase64
          );
          messageContent = `[IMAGEM RECEBIDA: ${visionDescription}] ${messageContent}`;
        } else if (messageType === 'audioMessage' && openaiKey && globalConfig) {
          const audioText = await transcribeAudio(
            globalConfig.evolution_url, 
            globalConfig.evolution_instance_name, 
            globalConfig.evolution_key, 
            messageId, 
            remoteJid, 
            openaiKey, 
            mediaBase64
          );
          messageContent = `[ÁUDIO RECEBIDO: ${audioText}] ${messageContent}`;
        }
      } catch (mediaError) {
        console.error('[Media Error]', mediaError);
      }

      const finalContent = messageContent || '';

      // 4. Detecção e Consulta de Código de Tracking (LINO.XXXXXX)
      const codeMatch = finalContent.match(/(?:LINO\.)([A-Z0-9]{6})/i);
      const extractedCode = codeMatch ? `LINO.${codeMatch[1].toUpperCase()}` : null;

      let trackingData: any = null;
      if (extractedCode) {
        const { data: clickRecord } = await supabase
          .from('lead_tracking_clicks')
          .select('*')
          .ilike('code', extractedCode)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (clickRecord) {
          trackingData = clickRecord;
        }
      }

      // 5. Buscar ou Criar Lead
      let { data: lead } = await supabase.from('leads').select('*').eq('whatsapp_number', remoteJid).maybeSingle();

      const generatedCode = `LINO.${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const activeCode = extractedCode || lead?.tracking_code || generatedCode;

      let contextSource = lead?.context_source || null;
      let contextInterest = lead?.context_interest || null;

      if (trackingData) {
        contextSource = trackingData.origem || trackingData.utm_source || 'Google Ads';
        contextInterest = trackingData.page_title || trackingData.page_path || 'Produtos Permetal';
      }

      if (!lead) {
        const { data: newLead, error: insertError } = await supabase.from('leads').insert([{ 
          whatsapp_number: remoteJid, 
          name: pushName || null,
          status: 'SDR_QUALIFICATION', 
          bot_active: true,
          tracking_code: activeCode,
          tracking_id: trackingData?.id || null,
          context_source: contextSource,
          context_interest: contextInterest,
          b2b_attempts: { cnpj: 0, email: 0, nome: 0, empresa: 0 }
        }]).select().single();
        
        if (insertError) {
          return NextResponse.json({ status: 'error', reason: 'LEAD_INSERT_FAILED', detail: insertError });
        }
        lead = newLead;
      } else {
        // Atualizar lead existente com dados de rastreio se novos
        const updates: any = {};
        if (!lead.tracking_code) updates.tracking_code = activeCode;
        if (trackingData && !lead.tracking_id) {
          updates.tracking_id = trackingData.id;
          updates.context_source = contextSource;
          updates.context_interest = contextInterest;
        }
        if (!lead.name && pushName) updates.name = pushName;

        if (Object.keys(updates).length > 0) {
          await supabase.from('leads').update(updates).eq('id', lead.id);
          lead = { ...lead, ...updates };
        }
      }

      if (!lead) return NextResponse.json({ status: 'error', reason: 'LEAD_NOT_FOUND' });
      if (!lead.bot_active) return NextResponse.json({ status: 'ignored', reason: 'LEAD_BOT_PAUSED' });

      // 6. Buffer rápido (debounce)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 7. Salvar Mensagem do Cliente no Histórico
      await supabase.from('interactions').insert([{ lead_id: lead.id, sender_type: 'lead', message_content: finalContent }]);

      // 8. Recuperar Histórico Recente
      const { data: historyData } = await supabase
        .from('interactions')
        .select('sender_type, message_content')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(10);

      const history = (historyData || []).reverse();

      // 9. TRIAGEM INTELIGENTE DE RETORNO (SDR vs SUPORTE vs PÓS-VENDA)
      const decision = classifyReturnIntent(finalContent, lead);
      let resposta_whatsapp = '';

      if (decision.mode === 'POS_VENDA') {
        // FLUXO PÓS-VENDA
        const posVendaResult = await processPostSaleMessage(history, lead.id);
        resposta_whatsapp = posVendaResult.resposta_whatsapp;
        await supabase.from('leads').update({ status: 'POS_VENDA', return_intent: 'POS_VENDA' }).eq('id', lead.id);

      } else if (decision.mode === 'SUPORTE') {
        // FLUXO SUPORTE / FISCALIZAÇÃO DE SLA
        const supportResult = await generateSupportResponse(lead, history);
        resposta_whatsapp = supportResult.resposta || supportResult.message;

        const updateData: any = { return_intent: 'SUPORTE' };
        if (decision.shouldAlertSla) {
          updateData.sla_breached = true;
        }
        await supabase.from('leads').update(updateData).eq('id', lead.id);

      } else {
        // FLUXO SDR (QUALIFICAÇÃO COM SCHEMA B2B E CATÁLOGO FACETADO)
        const aiResult = await processLeadWithSkills(history, lead.id);

        if (aiResult && !aiResult.erro_openai) {
          resposta_whatsapp = aiResult.resposta_whatsapp;

          const leadUpdate: any = { 
            updated_at: new Date().toISOString(),
            b2b_attempts: aiResult.b2b_attempts || lead.b2b_attempts
          };

          if (aiResult.cliente?.nome) leadUpdate.name = aiResult.cliente.nome;
          if (aiResult.cliente?.empresa) leadUpdate.company = aiResult.cliente.empresa;
          if (aiResult.cliente?.cnpj) leadUpdate.cnpj = aiResult.cliente.cnpj;
          if (aiResult.cliente?.email) leadUpdate.email_corporativo = aiResult.cliente.email;
          if (aiResult.demanda?.produto_normalizado) leadUpdate.detected_product = aiResult.demanda.produto_normalizado;
          if (aiResult.demanda?.quantidade_metragem) leadUpdate.quantidade = aiResult.demanda.quantidade_metragem;
          if (aiResult.demanda?.dimensoes) leadUpdate.especificacao = aiResult.demanda.dimensoes;

          if (aiResult.qualificacao_concluida) {
            leadUpdate.status = 'WAITING_SELLER';
            leadUpdate.qualification_completed = true;
          }

          await supabase.from('leads').update(leadUpdate).eq('id', lead.id);

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
        }
      }

      // 10. Enviar Resposta no WhatsApp via Evolution API e Salvar Histórico
      if (resposta_whatsapp) {
        await supabase.from('interactions').insert([{ 
          lead_id: lead.id, 
          sender_type: decision.mode === 'POS_VENDA' ? 'post_sale_ai' : decision.mode === 'SUPORTE' ? 'support_ai' : 'sdr_ai', 
          message_content: resposta_whatsapp 
        }]);

        if (globalConfig?.evolution_url && globalConfig?.evolution_key) {
          await sendTextMessage(
            globalConfig.evolution_instance_name || 'linooficial',
            globalConfig.evolution_url,
            globalConfig.evolution_key,
            remoteJid,
            resposta_whatsapp
          );
        }
      }

      return NextResponse.json({ status: 'success', mode: decision.mode, action: 'responded' });
    }

    return NextResponse.json({ status: 'ignored', reason: 'not_messages_upsert' });
  } catch (error: any) {
    console.error('[Webhook Error]', error);
    return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
  }
}
