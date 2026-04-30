import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { processLeadWithSkills } from '@/lib/openai';
import { routeLead } from '@/lib/router';
import { handleClientReturnedToSDR } from '@/lib/support-monitor';
import { sendTextMessage } from '@/lib/evolution-api';

// ⚠️ FILTRO DE TESTES: Apenas este número será processado. Remover após testes.
const WHITELIST_NUMBERS = ['5516991415319', '551691415319'];

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.event === 'messages.upsert') {
      const messageData = body.data?.messages?.[0];
      
      if (messageData?.key?.fromMe) {
        return NextResponse.json({ status: 'ignored', reason: 'from_me' });
      }

      const remoteJid = messageData?.key?.remoteJid; // Numero do cliente
      if (!remoteJid) return NextResponse.json({ status: 'ignored', reason: 'no_remoteJid' });

      // Filtro de whitelist — só processa números autorizados
      const cleanNumber = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
      if (!WHITELIST_NUMBERS.some(n => cleanNumber.includes(n))) {
        console.log(`[Webhook] Número ${cleanNumber} bloqueado (fora da whitelist de testes)`);
        return NextResponse.json({ status: 'ignored', reason: 'not_in_whitelist' });
      }

      const messageContent = messageData?.message?.conversation || 
                             messageData?.message?.extendedTextMessage?.text || '';

      if (!messageContent.trim()) {
        return NextResponse.json({ status: 'ignored', reason: 'empty_message' });
      }

      console.log(`[Webhook] Nova mensagem de ${remoteJid}: ${messageContent}`);

      // 1. VERIFICAÇÃO GTM (Lino.XXXXXX)
      const tagMatch = messageContent.match(/Lino\.[A-Z0-9]+/i);
      const gtmTag = tagMatch ? tagMatch[0] : null;

      // 2. BUSCAR OU CRIAR LEAD NO SUPABASE
      let { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('whatsapp_number', remoteJid)
        .single();

      if (!lead) {
        const { data: newLead } = await supabase
          .from('leads')
          .insert([{ whatsapp_number: remoteJid, gtm_tag: gtmTag, status: 'SDR_QUALIFICATION' }])
          .select()
          .single();
        lead = newLead;
        console.log('[CRM] Novo Lead Cadastrado no Supabase!');
      }

      // 3. LINO SUPORTE: Se o lead já está em WAITING_SELLER e o cliente
      //    voltou a falar na instância do SDR, significa que não foi atendido.
      if (lead && lead.status === 'WAITING_SELLER') {
        console.log(`[Lino Suporte] Cliente ${lead.name || remoteJid} voltou a falar — vendedor não atendeu!`);
        await handleClientReturnedToSDR(lead.id);
        return NextResponse.json({ status: 'success', action: 'support_notified', lead_id: lead.id });
      }

      // 4. CHATBOT CONVERSACIONAL
      if (lead && lead.status === 'SDR_QUALIFICATION') {
        // 4.1. Salvar a mensagem recebida no histórico
        await supabase.from('interactions').insert([
          { lead_id: lead.id, sender_type: 'lead', message_content: messageContent }
        ]);

        // 4.2. Buscar histórico recente (últimas 10 mensagens) para contexto
        const { data: history } = await supabase
          .from('interactions')
          .select('sender_type, message_content')
          .eq('lead_id', lead.id)
          .order('created_at', { ascending: true })
          .limit(10);

        // 4.3. Chamar a IA com o histórico
        console.log('[IA] Processando contexto conversacional...');
        const aiResult = await processLeadWithSkills(history || []);
        
        if (aiResult) {
          const { resposta_whatsapp, variaveis } = aiResult;
          console.log('[IA] Variáveis extraídas até agora:', variaveis);
          console.log('[IA] Resposta gerada:', resposta_whatsapp);

          // 4.4. Salvar resposta da IA no histórico
          if (resposta_whatsapp) {
            await supabase.from('interactions').insert([
              { lead_id: lead.id, sender_type: 'sdr_ai', message_content: resposta_whatsapp }
            ]);

            // 4.5. Enviar a mensagem para o cliente via Evolution API
            const { data: globalConfig } = await supabase.from('tenant_config').select('evolution_url, evolution_key, evolution_instance_name').limit(1).single();
            if (globalConfig?.evolution_url && globalConfig?.evolution_key) {
              await sendTextMessage(
                globalConfig.evolution_instance_name,
                globalConfig.evolution_url,
                globalConfig.evolution_key,
                remoteJid,
                resposta_whatsapp
              );
            } else {
              console.warn('[Webhook] Evolution API não configurada no tenant_config.');
            }
          }

          // 4.6. Verificar Condição de Roteamento (MÍNIMO: Produto e Região/DDD)
          // Consideramos que ddd tem 2 digitos
          const temProduto = !!variaveis?.produto;
          const temDDD = variaveis?.ddd && variaveis.ddd.length >= 2;

          if (temProduto && temDDD) {
            console.log('[Roteador] Requisitos mínimos atingidos. Iniciando transferência...');
            
            // Envia mensagem de transição (opcional, mas amigável)
            const transicao = "Aguarde um instante, já entendi o que você precisa e estou te transferindo para o especialista responsável por sua região.";
            await supabase.from('interactions').insert([{ lead_id: lead.id, sender_type: 'sdr_ai', message_content: transicao }]);
            
            const { data: globalConfig } = await supabase.from('tenant_config').select('evolution_url, evolution_key, evolution_instance_name').limit(1).single();
            if (globalConfig?.evolution_url && globalConfig?.evolution_key) {
              await sendTextMessage(globalConfig.evolution_instance_name, globalConfig.evolution_url, globalConfig.evolution_key, remoteJid, transicao);
            }

            // Aciona o Roteador e tira o lead de SDR_QUALIFICATION
            await routeLead(lead.id, lead.tenant_id, variaveis);
          } else {
            console.log('[Roteador] Aguardando mais informações do cliente...');
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
