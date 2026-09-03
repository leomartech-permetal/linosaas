/**
 * LINO DISPATCHER — Único ponto de saída WhatsApp v1
 *
 * Todo envio de mensagem WhatsApp do sistema deve passar por aqui.
 * Responsabilidades:
 *   1. Aplicar test guard antes de qualquer envio
 *   2. Em modo de teste: redirecionar ao sink autorizado com cabeçalho identificador
 *   3. Gravar na outbox (best-effort, não bloqueia envio)
 *   4. Enviar via Evolution API
 *   5. Atualizar status na outbox
 *
 * Nunca chamar fetch() à Evolution API diretamente fora deste módulo.
 */

import { supabaseServer } from './supabase-server';
import { isTestMode, isPhoneAuthorized, getTestSinkPhone, normalizePhone } from './test-guard';

export interface DispatchOptions {
  /** Número de destino lógico (vendedor, cliente, supervisor, etc.) */
  toPhone: string;
  /** Papel lógico do destinatário (para header de auditoria em modo teste) */
  logicalRole?: 'CUSTOMER' | 'SELLER' | 'SUPERVISOR' | 'SYSTEM';
  /** Nome legível do destinatário lógico (para header de auditoria) */
  logicalName?: string;
  /** Corpo da mensagem */
  body: string;
  /** Tipo de evento para auditoria */
  eventType?: string;
  /** Chave de idempotência (evita duplicação em retry) */
  idempotencyKey?: string;
  /** ID do lead/oportunidade correlacionado */
  correlationLeadId?: string;
  /** ID do tenant */
  tenantId?: string;
}

export interface DispatchResult {
  sent: boolean;
  blocked: boolean;
  physicalNumber: string | null;
  externalMessageId?: string;
  error?: string;
}

/**
 * Envia uma mensagem WhatsApp através do dispatcher centralizado.
 * Único ponto de saída — aplica test guard, redireciona em teste,
 * registra na outbox e envia via Evolution API.
 */
export async function dispatch(options: DispatchOptions): Promise<DispatchResult> {
  const {
    toPhone,
    logicalRole = 'CUSTOMER',
    logicalName,
    body,
    eventType = 'MESSAGE',
    idempotencyKey,
    correlationLeadId,
    tenantId,
  } = options;

  const normalizedTarget = normalizePhone(toPhone);
  if (!normalizedTarget) {
    console.warn(`[Dispatcher] Número inválido descartado: "${toPhone}"`);
    return { sent: false, blocked: true, physicalNumber: null, error: 'invalid_phone' };
  }

  // ── Resolução do número físico de destino ────────────────────────────────
  let physicalNumber = normalizedTarget;
  let auditHeader = '';

  if (isTestMode()) {
    if (!isPhoneAuthorized(normalizedTarget)) {
      // Redirecionar ao sink de teste
      const sink = getTestSinkPhone();
      if (!sink) {
        console.warn(`[Dispatcher] Modo teste sem sink configurado — mensagem descartada para ${normalizedTarget}`);
        return { sent: false, blocked: true, physicalNumber: null, error: 'no_test_sink' };
      }
      physicalNumber = sink;

      // Máscara de PII: exibe apenas últimos 4 dígitos nos logs
      const masked = normalizedTarget.slice(0, -4).replace(/\d/g, '*') + normalizedTarget.slice(-4);
      console.log(`[Dispatcher] Teste — redirecionando ${masked} (${logicalRole}) → ${sink}`);

      const recipientLabel = logicalName ? `${logicalName} (${logicalRole})` : logicalRole;
      auditHeader = `ℹ️ *[MODO TESTE — Destinatário lógico: ${recipientLabel}]*\n\n`;
    }
  }

  const finalBody = auditHeader + body;

  // ── Buscar config da Evolution API ──────────────────────────────────────
  const { data: config } = await supabaseServer
    .from('tenant_config')
    .select('evolution_url, evolution_key, evolution_instance_name')
    .limit(1)
    .single();

  if (!config?.evolution_url || !config?.evolution_key) {
    console.error('[Dispatcher] Evolution API não configurada.');
    return { sent: false, blocked: false, physicalNumber, error: 'evolution_not_configured' };
  }

  const url = `${config.evolution_url.replace(/\/+$/, '')}/message/sendText/${config.evolution_instance_name}`;

  // ── Registrar na outbox (best-effort) ───────────────────────────────────
  let outboxId: string | null = null;
  try {
    const { data: outboxRow } = await supabaseServer
      .from('outbound_messages')
      .insert([{
        tenant_id: tenantId,
        idempotency_key: idempotencyKey,
        logical_recipient: logicalName,
        logical_role: logicalRole,
        physical_number: physicalNumber,
        test_sink_number: isTestMode() && physicalNumber !== normalizedTarget ? physicalNumber : null,
        body: finalBody,
        event_type: eventType,
        correlation_lead_id: correlationLeadId,
        status: 'pending',
        attempts: 0,
      }])
      .select('id')
      .single();
    outboxId = outboxRow?.id ?? null;
  } catch (_e) {
    // outbox é best-effort — não bloqueia o envio
  }

  // ── Enviar via Evolution API ─────────────────────────────────────────────
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': config.evolution_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ number: physicalNumber, text: finalBody }),
    });

    const responseData = await response.json().catch(() => ({}));
    const externalId = responseData?.key?.id;
    const sent = response.status >= 200 && response.status < 300;

    // Atualizar outbox
    if (outboxId) {
      await supabaseServer
        .from('outbound_messages')
        .update({
          status: sent ? 'sent' : 'failed',
          sent_at: sent ? new Date().toISOString() : null,
          external_message_id: externalId,
          error: sent ? null : `HTTP ${response.status}`,
          attempts: 1,
        })
        .eq('id', outboxId);
    }

    if (!sent) {
      console.error(`[Dispatcher] Falha no envio HTTP ${response.status}:`, responseData);
      return { sent: false, blocked: false, physicalNumber, error: `http_${response.status}` };
    }

    return { sent: true, blocked: false, physicalNumber, externalMessageId: externalId };
  } catch (err: any) {
    console.error('[Dispatcher] Erro de rede:', err.message);
    if (outboxId) {
      await supabaseServer
        .from('outbound_messages')
        .update({ status: 'failed', error: err.message, attempts: 1 })
        .eq('id', outboxId);
    }
    return { sent: false, blocked: false, physicalNumber, error: err.message };
  }
}
