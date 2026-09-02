import { NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase-server';
import { processLeadWithSkills, generateSupportResponse } from '@/lib/openai';
import { processPostSaleMessage } from '@/lib/postsale';
import { classifyReturnIntent } from '@/lib/intent-classifier';
import { routeLead } from '@/lib/router';
import { sendTextMessage } from '@/lib/evolution-api';
import { describeImage, transcribeAudio } from '@/lib/multimodal';
import {
  isPhoneAuthorized,
  isTestMode,
  blockedWebhookResponse,
  normalizePhone,
} from '@/lib/test-guard';

/**
 * WEBHOOK EVOLUTION API — v3
 *
 * Guard de modo de teste aplicado IMEDIATAMENTE na entrada (ponto 0).
 * Qualquer remetente não autorizado recebe HTTP 200 silencioso,
 * sem acionar OpenAI, sem envio, sem roteamento, sem registro de estado.
 *
 * Idempotência persistida via whatsapp_messages (em paralelo com o Set
 * em memória como cache de curto prazo até que a migração v3 do banco
 * esteja ativa). Uma vez que a tabela whatsapp_messages tiver
 * external_message_id, o Set em memória pode ser removido.
 */

// Cache de curto prazo para deduplicação em memória (Fallback enquanto
// a tabela whatsapp_messages não tem external_message_id/unique constraint)
const processedMessageIds = new Set<string>();

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const messageData = body.data?.messages?.[0] || body.data;
    const remoteJid = messageData?.key?.remoteJid || messageData?.remoteJid || body.data?.key?.remoteJid || body.sender;
    const messageId = messageData?.key?.id || messageData?.id;
    const pushName: string | null = messageData?.pushName || body.data?.pushName || null;
    const instanceName: string = body.instance || body.instanceName || 'unknown';

    if (body.event === 'messages.upsert' || body.event === 'MESSAGES_UPSERT') {
      if (!messageData) return NextResponse.json({ status: 'ignored', reason: 'no_data' });

      // ════════════════════════════════════════════════════════════════
      // PONTO 0 — GUARD DE MODO DE TESTE (DEFESA EM PROFUNDIDADE)
      // Deve ser o PRIMEIRO check. Antes de qualquer acesso ao banco,
      // antes de qualquer chamada externa.
      // ════════════════════════════════════════════════════════════════
      if (remoteJid && isTestMode()) {
        if (!isPhoneAuthorized(remoteJid)) {
          // HTTP 200 silencioso: Evolution API não retentará
          return NextResponse.json(blockedWebhookResponse());
        }
      }

      // ════════════════════════════════════════════════════════════════
      // PONTO 1 — DEDUPLICAÇÃO (cache em memória + futuro banco)
      // ════════════════════════════════════════════════════════════════
      if (messageId) {
        if (processedMessageIds.has(messageId)) {
          return NextResponse.json({ status: 'ignored', reason: 'duplicate_retry' });
        }
        processedMessageIds.add(messageId);
        if (processedMessageIds.size > 1000) processedMessageIds.clear();
      }

      const fromMe = messageData.key?.fromMe;

      // ════════════════════════════════════════════════════════════════
      // PONTO 2 — ECO vs INTERVENÇÃO HUMANA REAL
      // fromMe=true pode ser: eco do Lino (bot enviou), painel CRM,
      // ou vendedor digitando no celular.
      // Diferenciação por instance: se a mensagem veio da instância
      // central (linooficial / chatbot), é eco do bot.
      // ════════════════════════════════════════════════════════════════
      if (fromMe) {
        // Verificar se a instância que enviou é a instância central do Lino
        const { data: globalConfig } = await supabase
          .from('tenant_config')
          .select('evolution_instance_name, tenant_id')
          .limit(1)
          .single();

        const centralInstance = globalConfig?.evolution_instance_name || 'linooficial';
        const isBotEcho = instanceName.toLowerCase() === centralInstance.toLowerCase() ||
                          instanceName === 'unknown';

        if (isBotEcho) {
          // Eco do Lino — ignorar silenciosamente, NÃO pausar o bot
          return NextResponse.json({ status: 'ignored', reason: 'bot_echo' });
        }

        // Mensagem enviada pelo VENDEDOR (instância diferente da central)
        // → Pausa o bot para essa conversa
        if (remoteJid) {
          const { data: leadToPause } = await supabase
            .from('leads')
            .select('id')
            .eq('whatsapp_number', remoteJid)
            .maybeSingle();
          if (leadToPause) {
            await supabase
              .from('leads')
              .update({ bot_active: false, last_mode: 'HUMAN_ACTIVE' })
              .eq('id', leadToPause.id);
          }
        }
        return NextResponse.json({ status: 'success', reason: 'human_intervention_recorded' });
      }

      if (!remoteJid) return NextResponse.json({ status: 'ignored', reason: 'no_remoteJid' });

      // ════════════════════════════════════════════════════════════════
      // PONTO 3 — IGNORAR FUNCIONÁRIOS INTERNOS
      // ════════════════════════════════════════════════════════════════
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

      // ════════════════════════════════════════════════════════════════
      // PONTO 4 — EXTRAÇÃO DE MENSAGEM
      // ════════════════════════════════════════════════════════════════
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

      // ════════════════════════════════════════════════════════════════
      // PONTO 5 — SUPORTE MULTIMODAL (Imagens e Áudios)
      // ════════════════════════════════════════════════════════════════
      const openaiKey = globalConfig?.openai_key;
      const messageType = messageData.messageType || Object.keys(messageObj || {}).find(k => k.endsWith('Message')) || '';

      try {
        const mediaBase64 = body.data?.base64 || messageData.base64 || null;
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

      // ════════════════════════════════════════════════════════════════
      // PONTO 6 — DETECÇÃO DE CÓDIGO DE TRACKING
      // ════════════════════════════════════════════════════════════════
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

      // ════════════════════════════════════════════════════════════════
      // PONTO 7 — BUSCAR OU CRIAR LEAD
      // ════════════════════════════════════════════════════════════════
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

      // ════════════════════════════════════════════════════════════════
      // PONTO 8 — SALVAR MENSAGEM NO HISTÓRICO
      // Nota: o debounce por setTimeout foi removido — mensagens
      // rápidas são agrupadas pela IA via histórico; o buffer
      // persistente deve ser implementado na migração de domínio.
      // ════════════════════════════════════════════════════════════════
      await supabase.from('interactions').insert([{ lead_id: lead.id, sender_type: 'lead', message_content: finalContent }]);

      // ════════════════════════════════════════════════════════════════
      // PONTO 9 — RECUPERAR HISTÓRICO RECENTE
      // ════════════════════════════════════════════════════════════════
      const { data: historyData } = await supabase
        .from('interactions')
        .select('sender_type, message_content')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(10);

      const history = (historyData || []).reverse();

      // ════════════════════════════════════════════════════════════════
      // PONTO 10 — TRIAGEM: SDR vs SUPORTE vs PÓS-VENDA
      // ════════════════════════════════════════════════════════════════
      const decision = classifyReturnIntent(finalContent, lead);
      let resposta_whatsapp = '';

      if (decision.mode === 'POS_VENDA') {
        const posVendaResult = await processPostSaleMessage(history, lead.id);
        resposta_whatsapp = posVendaResult.resposta_whatsapp;
        await supabase.from('leads').update({ status: 'POS_VENDA', return_intent: 'POS_VENDA' }).eq('id', lead.id);

      } else if (decision.mode === 'SUPORTE') {
        const supportResult = await generateSupportResponse(lead, history);
        resposta_whatsapp = supportResult.resposta || supportResult.message;

        const updateData: any = { return_intent: 'SUPORTE' };
        if (decision.shouldAlertSla) {
          updateData.sla_breached = true;
        }
        await supabase.from('leads').update(updateData).eq('id', lead.id);

      } else {
        // FLUXO SDR
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

          // A IA sugere qualificacao_concluida, mas o BACKEND valida deterministicamente
          if (aiResult.qualificacao_concluida) {
            leadUpdate.status = 'WAITING_SELLER';
            leadUpdate.qualification_completed = true;
          }

          await supabase.from('leads').update(leadUpdate).eq('id', lead.id);

          if (aiResult.qualificacao_concluida) {
            const normalizedPhone = normalizePhone(remoteJid) || remoteJid;
            const ddd = normalizedPhone.length >= 12 && normalizedPhone.startsWith('55')
              ? normalizedPhone.substring(2, 4)
              : '';
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

      // ════════════════════════════════════════════════════════════════
      // PONTO 11 — ENVIAR RESPOSTA (guard de saída integrado ao sendTextMessage)
      // ════════════════════════════════════════════════════════════════
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
