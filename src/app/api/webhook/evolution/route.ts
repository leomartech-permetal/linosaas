import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { processLeadWithSkills } from '@/lib/openai';
import { routeLead } from '@/lib/router';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.event === 'messages.upsert') {
      const messageData = body.data?.messages?.[0];
      
      if (messageData?.key?.fromMe) {
        return NextResponse.json({ status: 'ignored', reason: 'from_me' });
      }

      const remoteJid = messageData?.key?.remoteJid; // Numero do cliente
      const messageContent = messageData?.message?.conversation || 
                             messageData?.message?.extendedTextMessage?.text || '';

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
        // Criar novo lead
        const { data: newLead } = await supabase
          .from('leads')
          .insert([{ whatsapp_number: remoteJid, gtm_tag: gtmTag }])
          .select()
          .single();
        lead = newLead;
        console.log('[CRM] Novo Lead Cadastrado no Supabase!');
      }

      // 3. IA: EXTRAIR VARIÁVEIS DE CONTEXTO (Skills)
      if (lead && lead.status === 'SDR_QUALIFICATION') {
        const variables = await processLeadWithSkills(messageContent);
        console.log('[IA] Variáveis extraídas:', variables);
        
        if (variables) {
          // 4. ROTEADOR COMERCIAL: Acha o vendedor e atualiza o banco
          await routeLead(lead.id, lead.tenant_id, variables);
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
