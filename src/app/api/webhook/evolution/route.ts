import { NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase-server';
import { describeImage, transcribeAudio } from '@/lib/multimodal';
import { sendTextMessage } from '@/lib/evolution-api';
import {
  isPhoneAuthorized,
  isTestMode,
  blockedWebhookResponse,
  normalizePhone,
} from '@/lib/test-guard';
import { receiveInbound } from '@/lib/orchestrator';

/**
 * WEBHOOK EVOLUTION API — v4
 *
 * Responsabilidades neste handler:
 *   1. Validar estrutura e instância/tenant
 *   2. Aplicar test guard (P0) antes de qualquer acesso ao banco
 *   3. Deduplicação rápida em memória
 *   4. Tratar fromMe: distinguir eco do bot vs intervenção humana real
 *   5. Ignorar colaboradores internos que respondem (feito no orquestrador)
 *   6. Processar mídia (imagem/áudio) antes de encaminhar
 *   7. Encaminhar ao orquestrador via receiveInbound()
 *   8. Devolver 200 rapidamente
 *
 * Todo o processamento de estado, SLA, tickets, notificações e resposta
 * acontece dentro do orquestrador e seus módulos filhos.
 */

// Cache de curto prazo para deduplicação (fallback em memória)
const processedMessageIds = new Set<string>();

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const messageData = body.data?.messages?.[0] || body.data;
    const remoteJid: string = messageData?.key?.remoteJid || messageData?.remoteJid || body.data?.key?.remoteJid || body.sender || '';
    const messageId: string | undefined = messageData?.key?.id || messageData?.id;
    const pushName: string | null = messageData?.pushName || body.data?.pushName || null;
    const instanceName: string = body.instance || body.instanceName || 'unknown';

    if (body.event === 'messages.upsert' || body.event === 'MESSAGES_UPSERT') {
      if (!messageData) return NextResponse.json({ status: 'ignored', reason: 'no_data' });

      // ════════════════════════════════════════════════════════════════
      // P0 — GUARD DE MODO DE TESTE
      // Primeiro check absoluto. Qualquer número não autorizado recebe
      // HTTP 200 silencioso, sem acionar banco, OpenAI ou dispatcher.
      // ════════════════════════════════════════════════════════════════
      if (remoteJid && isTestMode()) {
        if (!isPhoneAuthorized(remoteJid)) {
          return NextResponse.json(blockedWebhookResponse());
        }
      }

      // ════════════════════════════════════════════════════════════════
      // P1 — DEDUPLICAÇÃO em memória (fallback)
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
      // P2 — ECO vs INTERVENÇÃO HUMANA REAL
      // fromMe=true pode ser eco do bot ou vendedor digitando no celular.
      // ════════════════════════════════════════════════════════════════
      if (fromMe) {
        const { data: globalConfig } = await supabase
          .from('tenant_config')
          .select('evolution_instance_name, tenant_id')
          .limit(1)
          .single();

        const centralInstance = globalConfig?.evolution_instance_name || 'linooficial';
        const isBotEcho =
          instanceName.toLowerCase() === centralInstance.toLowerCase() ||
          instanceName === 'unknown';

        if (isBotEcho) {
          return NextResponse.json({ status: 'ignored', reason: 'bot_echo' });
        }

        // Mensagem enviada pelo VENDEDOR (instância diferente) — pausar bot
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
      // P3 — CONFIG GLOBAL E BOT STATUS
      // ════════════════════════════════════════════════════════════════
      const { data: globalConfig } = await supabase
        .from('tenant_config')
        .select('*')
        .limit(1)
        .single();

      if (globalConfig?.bot_active === false) {
        return NextResponse.json({ status: 'ignored', reason: 'GLOBAL_BOT_OFF' });
      }

      // ════════════════════════════════════════════════════════════════
      // P4 — EXTRAÇÃO DE MENSAGEM
      // ════════════════════════════════════════════════════════════════
      const messageObj = messageData.message || messageData;
      let messageContent =
        messageObj?.conversation ||
        messageObj?.extendedTextMessage?.text ||
        messageObj?.text ||
        messageData?.text ||
        messageObj?.imageMessage?.caption ||
        messageObj?.videoMessage?.caption ||
        messageObj?.documentMessage?.caption ||
        '';

      // ════════════════════════════════════════════════════════════════
      // P5 — PROCESSAMENTO DE MÍDIA (imagem/áudio)
      // ════════════════════════════════════════════════════════════════
      const openaiKey = globalConfig?.openai_key;
      const messageType =
        messageData.messageType ||
        Object.keys(messageObj || {}).find(k => k.endsWith('Message')) ||
        '';

      try {
        const mediaBase64 = body.data?.base64 || messageData.base64 || null;
        if (messageType === 'imageMessage' && openaiKey && globalConfig) {
          const visionDescription = await describeImage(
            globalConfig.evolution_url,
            globalConfig.evolution_instance_name,
            globalConfig.evolution_key,
            messageId || '',
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
            messageId || '',
            remoteJid,
            openaiKey,
            mediaBase64
          );
          messageContent = `[ÁUDIO RECEBIDO: ${audioText}] ${messageContent}`;
        }
      } catch (mediaError) {
        console.error('[Webhook Media Error]', mediaError);
      }

      const finalContent = messageContent || '';

      // ════════════════════════════════════════════════════════════════
      // P6 — DETECÇÃO DE CÓDIGO DE TRACKING
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
        if (clickRecord) trackingData = clickRecord;
      }

      // ════════════════════════════════════════════════════════════════
      // P7 — BUSCAR OU CRIAR LEAD
      // ════════════════════════════════════════════════════════════════
      let { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('whatsapp_number', remoteJid)
        .maybeSingle();

      const generatedCode = `LINO.${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const activeCode = extractedCode || lead?.tracking_code || generatedCode;

      const contextSource = trackingData?.origem || trackingData?.utm_source || lead?.context_source || null;
      const contextInterest = trackingData?.page_title || trackingData?.page_path || lead?.context_interest || null;

      if (!lead) {
        const { data: newLead, error: insertError } = await supabase
          .from('leads')
          .insert([{
            whatsapp_number: remoteJid,
            name: pushName || null,
            status: 'SDR_QUALIFICATION',
            bot_active: true,
            tracking_code: activeCode,
            tracking_id: trackingData?.id || null,
            context_source: contextSource,
            context_interest: contextInterest,
            b2b_attempts: { cnpj: 0, email: 0, nome: 0, empresa: 0 },
            tenant_id: globalConfig?.tenant_id || null,
          }])
          .select()
          .single();

        if (insertError) {
          return NextResponse.json({ status: 'error', reason: 'LEAD_INSERT_FAILED' });
        }
        lead = newLead;
      } else {
        const updates: any = {};
        const isNewQuoteRequest = /(?:quero|preciso|solicito|gostaria|cotar|cota[çc][aã]o|or[çc]amento|projeto|metro\s*linear|metros\s*lineares|gradil|chapa)/i.test(finalContent);
        const hasNewCompanyMention = /(?:empresa|construtora|ind[uú]stria|engenharia|metal[uú]rgica)/i.test(finalContent);

        if (extractedCode || isNewQuoteRequest || (lead.qualification_completed && !lead.current_owner_id)) {
          if (extractedCode) updates.tracking_code = extractedCode;
          if (trackingData) {
            updates.tracking_id = trackingData.id;
            updates.context_source = trackingData.origem || trackingData.utm_source || 'Site';
            updates.context_interest = trackingData.page_title || trackingData.page_path || 'Gradis e Pisos';
          }
          // Resetar para nova qualificação SDR
          updates.status = 'SDR_QUALIFICATION';
          updates.qualification_completed = false;
          updates.return_intent = 'SDR';
          updates.last_mode = 'SDR';
          updates.b2b_attempts = { cnpj: 0, email: 0, nome: 0, empresa: 0 };
          updates.produto = null;
          updates.detected_product = null;
          updates.quantidade = null;
          updates.especificacao = null;
          updates.observacao = null;
          updates.qualification_state = null;
          updates.current_owner_id = null;
          updates.sent_to_seller_at = null;

          // Se a mensagem apresenta uma nova empresa ou é uma nova cotação, não herdar CNPJ e e-mail antigos
          if (hasNewCompanyMention || isNewQuoteRequest) {
            updates.cnpj = null;
            updates.email_corporativo = null;
          }
        } else {
          if (!lead.tracking_code) updates.tracking_code = activeCode;
          if (trackingData && !lead.tracking_id) {
            updates.tracking_id = trackingData.id;
            updates.context_source = contextSource;
            updates.context_interest = contextInterest;
          }
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
      // P8 — ENCAMINHAR AO ORQUESTRADOR UNIFICADO
      // O orquestrador aplica o buffer de 5s, detecta colaboradores,
      // calcula SLA, abre tickets e compõe a resposta verdadeira.
      // ════════════════════════════════════════════════════════════════
      const result = await receiveInbound({
        tenantId: globalConfig?.tenant_id || lead.tenant_id || undefined,
        instanceId: instanceName,
        externalMessageId: messageId,
        fromNumber: remoteJid,
        pushName,
        body: finalContent,
        messageType,
        rawPayload: body,
      });

      return NextResponse.json({ status: result.status, mode: result.mode, action: result.reason });
    }

    return NextResponse.json({ status: 'ignored', reason: 'not_messages_upsert' });
  } catch (error: any) {
    console.error('[Webhook Error]', error);
    return NextResponse.json({ status: 'error', error: 'Erro interno.' }, { status: 500 });
  }
}
