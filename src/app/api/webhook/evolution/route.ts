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

    // Log para debug
    console.log('[Webhook] Evento:', body.event);
    const messageData = body.data?.messages?.[0] || body.data;
    const remoteJid = messageData?.key?.remoteJid || body.data?.key?.remoteJid || body.sender;

    if (body.event === 'messages.upsert') {
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

      // 2. EXTRAÇÃO E MULTIMÍDIA
      const messageType = Object.keys(messageData.message || {})[0];
      let messageContent = messageData.message?.conversation || 
                           messageData.message?.extendedTextMessage?.text || 
                           '';
      
      const { data: globalConfig } = await supabase.from('tenant_config').select('*').limit(1).single();
      const openaiKey = globalConfig?.openai_key;

      if (messageType === 'imageMessage' && openaiKey) {
        const imageUrl = messageData.message.imageMessage.url || '';
        const visionDescription = await describeImage(imageUrl, openaiKey, messageContent);
        messageContent = `[IMAGEM RECEBIDA: ${visionDescription}] ${messageContent}`;
      }

      if (messageType === 'audioMessage' && openaiKey) {
        const audioUrl = messageData.message.audioMessage.url || '';
        const audioText = await transcribeAudio(audioUrl, openaiKey);
        messageContent = `[ÁUDIO RECEBIDO: ${audioText}] ${messageContent}`;
      }

      if (!remoteJid) return NextResponse.json({ status: 'ignored', reason: 'no_remoteJid' });

      const cleanNumber = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      if (!WHITELIST_NUMBERS.some(n => cleanNumber.includes(n))) {
        return NextResponse.json({ status: 'ignored', reason: 'not_in_whitelist' });
      }

      // 2. EXTRAÇÃO DE CONTEÚDO (Texto ou Mídia)
      const messageType = Object.keys(messageData.message || {})[0];
      let messageContent = messageData.message?.conversation || 
                           messageData.message?.extendedTextMessage?.text || 
                           '';
      
      let mediaUrl = '';
      let mediaType = '';

      if (['imageMessage', 'audioMessage', 'documentMessage'].includes(messageType)) {
        mediaType = messageType.replace('Message', '');
        // A Evolution API geralmente manda a URL da mídia se o webhook estiver configurado para isso
        mediaUrl = messageData.message[messageType]?.url || ''; 
      }

      if (!messageContent.trim() && !mediaUrl) {
        return NextResponse.json({ status: 'ignored', reason: 'empty_content' });
      }

      // 3. BUSCAR CONFIGURAÇÃO E LEAD
      const { data: globalConfig } = await supabase.from('tenant_config').select('*').limit(1).single();
      if (globalConfig?.bot_active === false) return NextResponse.json({ status: 'ignored', reason: 'global_bot_off' });

      let { data: lead } = await supabase.from('leads').select('*').eq('whatsapp_number', remoteJid).single();
      if (!lead) {
        const { data: newLead } = await supabase.from('leads').insert([{ 
          whatsapp_number: remoteJid, status: 'SDR_QUALIFICATION', tenant_id: globalConfig?.id 
        }]).select().single();
        lead = newLead;
      }

      if (!lead.bot_active) return NextResponse.json({ status: 'ignored', reason: 'lead_bot_paused' });

      // 4. SISTEMA DE BUFFER (DEBOUNCE)
      // Salva no buffer para processar depois de 10 segundos de silêncio
      const { data: bufferEntry } = await supabase.from('conversation_buffers').insert([{
        lead_id: lead.id,
        content: messageContent,
        media_attachment_id: null // Poderíamos salvar o anexo aqui se processado
      }]).select().single();

      console.log(`[Webhook] Mensagem de ${remoteJid} adicionada ao buffer.`);

      // Aguarda 10 segundos (Debounce)
      await new Promise(resolve => setTimeout(resolve, 10000));

      // Verifica se houve alguma mensagem MAIS NOVA no buffer. Se sim, deixa a outra instância processar.
      const { data: newerMessages } = await supabase
        .from('conversation_buffers')
        .select('id')
        .eq('lead_id', lead.id)
        .gt('created_at', bufferEntry.created_at)
        .eq('processed', false);

      if (newerMessages && newerMessages.length > 0) {
        return NextResponse.json({ status: 'success', detail: 'waiting_for_more_messages' });
      }

      // Se chegamos aqui, somos a última mensagem. Vamos processar TUDO do buffer.
      const { data: allUnprocessed } = await supabase
        .from('conversation_buffers')
        .select('*')
        .eq('lead_id', lead.id)
        .eq('processed', false)
        .order('created_at', { ascending: true });

      if (!allUnprocessed || allUnprocessed.length === 0) return NextResponse.json({ status: 'ignored' });

      // Marcar como processado
      await supabase.from('conversation_buffers').update({ processed: true }).eq('lead_id', lead.id).eq('processed', false);

      const fullContext = allUnprocessed.map(m => m.content).filter(Boolean).join(' | ');

      // 5. SALVAR INTERAÇÃO E PROCESSAR IA
      await supabase.from('interactions').insert([{ lead_id: lead.id, sender_type: 'lead', message_content: fullContext }]);

      if (lead.status === 'SDR_QUALIFICATION') {
        const { data: historyData } = await supabase.from('interactions').select('sender_type, message_content').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(15);
        const history = (historyData || []).reverse();

        const aiResult = await processLeadWithSkills(history || []);
        
        if (aiResult && !aiResult.erro_openai) {
          const { resposta_whatsapp, variaveis } = aiResult;
          
          // Atualiza Lead
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
      }

      return NextResponse.json({ status: 'success', processed_count: allUnprocessed.length });
    }

      return NextResponse.json({ status: 'success', lead_id: lead?.id });
    }

    return NextResponse.json({ status: 'ignored', event: body.event });
  } catch (error) {
    console.error('[Webhook Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
