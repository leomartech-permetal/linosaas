import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { processLeadWithSkills } from '@/lib/openai';
import { routeLead } from '@/lib/router';
import { handleClientReturnedToSDR } from '@/lib/support-monitor';
import { sendTextMessage } from '@/lib/evolution-api';
import { describeImage, transcribeAudio } from '@/lib/multimodal';

const WHITELIST_NUMBERS = ['5516991415319', '551635187121', '551699141531', '55163518712'];

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Captura flexível dos dados da mensagem
    const messageData = body.data?.messages?.[0] || body.data;
    const remoteJid = messageData?.key?.remoteJid || messageData?.remoteJid || body.data?.key?.remoteJid || body.sender;
    const messageId = messageData?.key?.id || messageData?.id;

    if (body.event === 'messages.upsert' || body.event === 'MESSAGES_UPSERT') {
      if (!messageData) return NextResponse.json({ status: 'ignored', reason: 'no_data' });

      const fromMe = messageData.key?.fromMe;

      // 1. INTERVENÇÃO HUMANA
      if (fromMe) {
        const { data: leadToPause } = await supabase.from('leads').select('id').eq('whatsapp_number', remoteJid).single();
        if (leadToPause) {
          await supabase.from('leads').update({ bot_active: false }).eq('id', leadToPause.id);
        }
        return NextResponse.json({ status: 'success', reason: 'human_intervention' });
      }

      if (!remoteJid) return NextResponse.json({ status: 'ignored', reason: 'no_remoteJid' });

      // 2. EXTRAÇÃO DE TEXTO
      const messageObj = messageData.message || messageData;
      let messageContent = messageObj?.conversation || 
                           messageObj?.extendedTextMessage?.text || 
                           messageObj?.text ||
                           messageData?.text ||
                           messageObj?.imageMessage?.caption ||
                           messageObj?.videoMessage?.caption ||
                           messageObj?.documentMessage?.caption ||
                           '';
      
      console.log(`[Webhook] Recebido: "${messageContent}" de ${remoteJid}`);

      const { data: globalConfig } = await supabase.from('tenant_config').select('*').limit(1).single();
      if (globalConfig?.bot_active === false) return NextResponse.json({ status: 'ignored', reason: 'GLOBAL_BOT_OFF' });

      // 3. BUSCAR/CRIAR LEAD
      let { data: lead } = await supabase.from('leads').select('*').eq('whatsapp_number', remoteJid).single();
      if (!lead) {
        console.log('[Webhook] Criando novo lead para:', remoteJid);
        const { data: newLead, error: insertError } = await supabase.from('leads').insert([{ 
          whatsapp_number: remoteJid, 
          status: 'SDR_QUALIFICATION', 
          tenant_id: globalConfig?.id,
          bot_active: true // Forçar ativo na criação
        }]).select().single();
        
        if (insertError) {
          console.error('[Webhook] Erro ao inserir lead:', insertError);
          return NextResponse.json({ status: 'error', reason: 'LEAD_INSERT_FAILED', detail: insertError });
        }
        lead = newLead;
      }

      if (!lead) return NextResponse.json({ status: 'error', reason: 'LEAD_NOT_FOUND_AFTER_INSERT' });
      if (!lead.bot_active) return NextResponse.json({ status: 'ignored', reason: 'LEAD_BOT_PAUSED' });

      // 4. PROCESSAMENTO MULTIMODAL
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
        } else if (messageType === 'documentMessage') {
          const fileName = messageObj.documentMessage?.fileName || 'documento.pdf';
          messageContent = `[DOCUMENTO RECEBIDO: ${fileName}] ${messageContent}`;
        }
      } catch (mediaError) {
        console.error('[Media Error]', mediaError);
      }

      // 5. SISTEMA DE BUFFER (DEBOUNCE)
      // Plano de Ação - Correção 1: Garantir texto de qualquer campo
      const finalContent = messageContent 
        || (messageData as any).texto_completo 
        || (messageData as any).texto_midia 
        || (messageData as any).message_raw 
        || '';

      console.log(`[Webhook] Processando para o Buffer: "${finalContent.substring(0, 50)}..."`);

      const { data: bufferEntry, error: bufferError } = await supabase.from('conversation_buffers').insert([{
        lead_id: lead.id,
        content: finalContent
      }]).select().single();

      if (bufferError) {
        console.error('[Buffer Error]', bufferError);
        return NextResponse.json({ status: 'error', reason: 'BUFFER_INSERT_FAILED', detail: bufferError });
      }

      // Plano de Ação - Correção 2: Forçar processamento se for a primeira ou se já passou o tempo
      // Primeiro, verificamos se há outras mensagens não processadas ANTES desta
      const { data: previousMessages } = await supabase
        .from('conversation_buffers')
        .select('id')
        .eq('lead_id', lead.id)
        .lt('created_at', bufferEntry.created_at)
        .eq('processed', false);

      const isPrimeiraMensagem = !previousMessages || previousMessages.length === 0;
      
      // Se for a primeira mensagem, podemos esperar menos ou processar logo
      const waitTime = isPrimeiraMensagem ? 4000 : 10000; 
      console.log(`[Webhook] Aguardando ${waitTime}ms (Primeira: ${isPrimeiraMensagem})`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));

      const { data: newerMessages } = await supabase
        .from('conversation_buffers')
        .select('id')
        .eq('lead_id', lead.id)
        .gt('created_at', bufferEntry.created_at)
        .eq('processed', false);

      if (newerMessages && newerMessages.length > 0) {
        return NextResponse.json({ status: 'success', detail: 'WAITING_FOR_MORE_MESSAGES' });
      }

      const { data: allUnprocessed } = await supabase
        .from('conversation_buffers')
        .select('*')
        .eq('lead_id', lead.id)
        .eq('processed', false)
        .order('created_at', { ascending: true });

      if (!allUnprocessed || allUnprocessed.length === 0) return NextResponse.json({ status: 'ignored' });

      await supabase.from('conversation_buffers').update({ processed: true }).eq('lead_id', lead.id).eq('processed', false);

      const fullContext = allUnprocessed.map(m => m.content).filter(Boolean).join(' | ');

      // 6. SALVAR INTERAÇÃO
      await supabase.from('interactions').insert([{ lead_id: lead.id, sender_type: 'lead', message_content: fullContext }]);

      // 7. LÓGICA DE RESPOSTA (SDR OU ESPERA)
      if (lead.status === 'SDR_QUALIFICATION') {
        const { data: historyData } = await supabase.from('interactions').select('sender_type, message_content').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(15);
        const history = (historyData || []).reverse();

        const aiResult = await processLeadWithSkills(history || []);
        
        if (aiResult && !aiResult.erro_openai) {
          const { resposta_whatsapp, variaveis } = aiResult;
          
          const leadUpdate: any = { updated_at: new Date().toISOString() };
          if (variaveis?.produto) leadUpdate.detected_product = variaveis.produto;
          if (variaveis?.ddd) leadUpdate.detected_ddd = variaveis.ddd;
          if (variaveis?.empresa) leadUpdate.company = variaveis.empresa;
          if (variaveis?.nome_cliente) leadUpdate.name = variaveis.nome_cliente;
          await supabase.from('leads').update(leadUpdate).eq('id', lead.id);

          if (resposta_whatsapp) {
            await supabase.from('interactions').insert([{ lead_id: lead.id, sender_type: 'sdr_ai', message_content: resposta_whatsapp }]);
            if (globalConfig?.evolution_url && globalConfig?.evolution_key) {
              await sendTextMessage(globalConfig.evolution_instance_name, globalConfig.evolution_url, globalConfig.evolution_key, remoteJid, resposta_whatsapp);
            }
          }

          if (!!variaveis?.produto && (variaveis?.ddd?.length >= 2 || variaveis?.cidade?.length > 3)) {
            await sendTextMessage(globalConfig.evolution_instance_name, globalConfig.evolution_url, globalConfig.evolution_key, remoteJid, "Estou te transferindo para o especialista agora...");
            await routeLead(lead.id, lead.tenant_id, variaveis);
          }
        }
      } else if (lead.status === 'WAITING_SELLER') {
        // Se o cliente continuar falando, o Lino avisa que o especialista está vindo
        const msgAviso = "O consultor especialista já recebeu seus dados e entrará em contato em instantes por aqui. Se preferir adiantar algo, pode mandar!";
        await supabase.from('interactions').insert([{ lead_id: lead.id, sender_type: 'sdr_ai', message_content: msgAviso }]);
        if (globalConfig?.evolution_url && globalConfig?.evolution_key) {
          await sendTextMessage(globalConfig.evolution_instance_name, globalConfig.evolution_url, globalConfig.evolution_key, remoteJid, msgAviso);
        }
      }

      return NextResponse.json({ status: 'success', processed_count: allUnprocessed.length });
    }

    return NextResponse.json({ status: 'ignored', event: body.event });
  } catch (error) {
    console.error('[Webhook Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
