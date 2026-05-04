import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { processLeadWithSkills } from '@/lib/openai';
import { routeLead } from '@/lib/router';
import { handleClientReturnedToSDR } from '@/lib/support-monitor';
import { sendTextMessage } from '@/lib/evolution-api';

const WHITELIST_NUMBERS = ['5516991415319', '551635187121', '551699141531', '55163518712'];

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Log para debug
    console.log('[Webhook] Evento:', body.event);
    const remoteJid = body.data?.messages?.[0]?.key?.remoteJid || body.sender;
    console.log('[Webhook] Sender:', remoteJid);

    if (body.event === 'messages.upsert') {
      const messageData = body.data?.messages?.[0] || body.data;
      
      if (!messageData || messageData.key?.fromMe) {
        return NextResponse.json({ status: 'ignored', reason: 'from_me_or_no_data' });
      }

      const remoteJid = messageData.key?.remoteJid;
      if (!remoteJid) return NextResponse.json({ status: 'ignored', reason: 'no_remoteJid' });

      const cleanNumber = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      if (!WHITELIST_NUMBERS.some(n => cleanNumber.includes(n))) {
        return NextResponse.json({ status: 'ignored', reason: 'not_in_whitelist' });
      }

      const messageContent = messageData.message?.conversation || 
                             messageData.message?.extendedTextMessage?.text || 
                             '';

      if (!messageContent.trim()) {
        return NextResponse.json({ status: 'ignored', reason: 'empty_message' });
      }

      // 1. BUSCAR OU CRIAR LEAD (Sem Whitelist para testes)
      let { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('whatsapp_number', remoteJid)
        .single();

      if (!lead) {
        const { data: newLead } = await supabase
          .from('leads')
          .insert([{ whatsapp_number: remoteJid, status: 'SDR_QUALIFICATION' }])
          .select()
          .single();
        lead = newLead;
      }

      // 2. SALVAR MENSAGEM DO LEAD
      await supabase.from('interactions').insert([
        { lead_id: lead.id, sender_type: 'lead', message_content: messageContent }
      ]);

      // 3. PROCESSAMENTO DA IA
      if (lead.status === 'WAITING_SELLER') {
        await handleClientReturnedToSDR(lead.id);
        return NextResponse.json({ status: 'success', action: 'support_notified' });
      }

      if (lead.status === 'SDR_QUALIFICATION') {
        const { data: history } = await supabase
          .from('interactions')
          .select('sender_type, message_content')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: true })
          .limit(10);

        const { data: globalConfig } = await supabase.from('tenant_config').select('*').limit(1).single();

        // Checagem se o bot está ligado globalmente
        if (globalConfig?.bot_active === false) {
          console.log('[Webhook] Robô desligado globalmente. Ignorando mensagem.');
          return NextResponse.json({ status: 'ignored', reason: 'bot_disabled' });
        }

        const aiResult = await processLeadWithSkills(history || []);
        
        if (!aiResult || aiResult.erro_openai) {
          const erroDetalhado = aiResult?.erro_openai || 'Falha na comunicação com a OpenAI. Verifique a chave da API no painel da Vercel.';
          await supabase.from('interactions').insert([
            { lead_id: lead.id, sender_type: 'sdr_ai', message_content: `[ERRO IA] ${erroDetalhado}` }
          ]);
          return NextResponse.json({ status: 'success', error: 'ai_failed' });
        }
        
        if (aiResult) {
          const { resposta_whatsapp, variaveis } = aiResult;

          if (resposta_whatsapp) {
            await supabase.from('interactions').insert([
              { lead_id: lead.id, sender_type: 'sdr_ai', message_content: resposta_whatsapp }
            ]);

            if (globalConfig?.evolution_url && globalConfig?.evolution_key) {
              await sendTextMessage(
                globalConfig.evolution_instance_name,
                globalConfig.evolution_url,
                globalConfig.evolution_key,
                remoteJid,
                resposta_whatsapp
              );
            }
          }

          const temProduto = !!variaveis?.produto;
          const temDDD = variaveis?.ddd && variaveis.ddd.length >= 2;

          if (temProduto && temDDD && globalConfig) {
            const transicao = "Estou te transferindo para o especialista agora...";
            await sendTextMessage(
              globalConfig.evolution_instance_name, 
              globalConfig.evolution_url, 
              globalConfig.evolution_key, 
              remoteJid, 
              transicao
            );
            await routeLead(lead.id, lead.tenant_id, variaveis);
          }
        }
      }

      return NextResponse.json({ status: 'success', lead_id: lead?.id });
    }

    return NextResponse.json({ status: 'ignored', event: body.event });
  } catch (error) {
    console.error('[Webhook Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
