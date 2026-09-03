/**
 * LINO ORCHESTRATOR — Orquestrador Unificado de Entrada v1
 *
 * Único ponto de decisão para mensagens de clientes.
 * Fluxo obrigatório:
 *   1. Verificar idempotência via inbound_messages
 *   2. Identificar contato (cliente vs colaborador)
 *   3. Respeitar pausa/atendimento humano
 *   4. Montar contexto via ConversationContextBuilder
 *   5. Decidir fluxo por evidências determinísticas
 *   6. Classificar intenção (LLM) somente dentro das opções permitidas
 *   7. Executar ações transacionais
 *   8. Compor resposta com base nos resultados reais das ações
 *   9. Gravar na outbox e enviar pelo dispatcher
 *
 * PROIBIDO:
 *   - Responder antes de executar as ações
 *   - Usar verbos de ação no passado sem evento confirmado
 *   - Chamar Evolution API fora do dispatcher
 */

import { supabaseServer as supabase } from './supabase-server';
import { normalizePhone } from './test-guard';
import { dispatch } from './dispatcher';
import { classifyReturnIntent } from './intent-classifier';
import { processLeadWithSkills, generateSupportResponse } from './openai';
import { processPostSaleMessage } from './postsale';
import { routeLead } from './router';
import { computeSlaStatus, DEFAULT_SLA_POLICY, isWithinGroupingWindow } from './sla-service';
import type { SlaPolicy } from './sla-service';

export interface InboundEvent {
  tenantId?: string;
  instanceId: string;
  externalMessageId?: string;
  fromNumber: string;           // JID completo (ex: 5516999...@s.whatsapp.net)
  pushName?: string | null;
  body: string;
  messageType?: string;
  rawPayload?: unknown;
}

export interface OrchestratorResult {
  status: 'ignored' | 'processed' | 'error';
  reason?: string;
  mode?: 'SDR' | 'SUPORTE' | 'POS_VENDA' | 'SELLER_RESPONSE';
  action?: string;
}

// ─── Deduplicação em memória (fallback enquanto inbound_messages não está no banco) ─
const recentInboundIds = new Set<string>();

// ─── Buffer de micro-rajada (5 segundos por conversa) ───────────────────────────────
// Agrupa mensagens consecutivas rápidas em uma única rodada de processamento.
// Implementação em memória — em serverless cada instância tem seu próprio buffer.
// Para persistência durável, usar a tabela inbound_messages com status='pending'.
const messageBurst: Map<string, NodeJS.Timeout> = new Map();

/**
 * Entry point principal do webhook.
 * Retorna rapidamente enquanto o processamento real ocorre de forma assíncrona (5s buffer).
 */
export async function receiveInbound(event: InboundEvent): Promise<OrchestratorResult> {
  const normalizedFrom = normalizePhone(event.fromNumber);
  if (!normalizedFrom) {
    return { status: 'ignored', reason: 'invalid_phone' };
  }

  // ── Idempotência: evitar processar duplicatas ──────────────────────────────
  if (event.externalMessageId) {
    if (recentInboundIds.has(event.externalMessageId)) {
      return { status: 'ignored', reason: 'duplicate' };
    }
    // Verificar idempotência durável na tabela inbound_messages (se disponível)
    try {
      const { error: dupCheck } = await supabase
        .from('inbound_messages')
        .insert([{
          tenant_id: event.tenantId,
          provider: 'evolution',
          instance_id: event.instanceId,
          external_message_id: event.externalMessageId,
          from_number: normalizedFrom,
          body: event.body,
          message_type: event.messageType,
          raw_payload: event.rawPayload as any,
          status: 'pending',
        }]);

      if (dupCheck?.code === '23505') {
        // Unique constraint violation = mensagem já processada
        return { status: 'ignored', reason: 'duplicate_db' };
      }
    } catch {
      // inbound_messages pode não existir ainda — usar fallback em memória
      recentInboundIds.add(event.externalMessageId);
      if (recentInboundIds.size > 1000) recentInboundIds.clear();
    }
  }

  // ── Verificar se remetente é colaborador interno ───────────────────────────
  const isCollaborator = await checkIfCollaborator(normalizedFrom);
  if (isCollaborator) {
    // Respostas de colaboradores são tratadas pelo seller-response-handler (async)
    await processSellerResponse(normalizedFrom, event.body, event.tenantId);
    return { status: 'processed', mode: 'SELLER_RESPONSE', reason: 'collaborator_response' };
  }

  // ── Buffer de micro-rajada (5 segundos) ───────────────────────────────────
  // Cancela o timer anterior e reabre, acumulando mensagens rápidas
  const burstKey = `${normalizedFrom}`;
  if (messageBurst.has(burstKey)) {
    clearTimeout(messageBurst.get(burstKey)!);
  }

  // Processar após o buffer de 5 segundos
  const timer = setTimeout(async () => {
    messageBurst.delete(burstKey);
    await processInboundMessage(normalizedFrom, event);
  }, 5000);

  messageBurst.set(burstKey, timer);

  return { status: 'processed', reason: 'queued_burst_buffer' };
}

/**
 * Processamento principal — executado após o buffer de micro-rajada.
 */
async function processInboundMessage(
  normalizedFrom: string,
  event: InboundEvent
): Promise<void> {
  try {
    // ── Carregar lead ─────────────────────────────────────────────────────────
    const { data: lead } = await supabase
      .from('leads')
      .select('*')
      .eq('whatsapp_number', event.fromNumber)
      .maybeSingle();

    if (!lead) {
      console.log(`[Orchestrator] Lead não encontrado para ${normalizedFrom} — aguardando webhook criar.`);
      return;
    }

    // ── Respeitar pausa/atendimento humano ────────────────────────────────────
    if (!lead.bot_active || lead.last_mode === 'HUMAN_ACTIVE') {
      console.log(`[Orchestrator] Bot pausado para ${normalizedFrom}`);
      return;
    }

    // ── Carregar política de SLA ──────────────────────────────────────────────
    let slaPolicy: SlaPolicy = DEFAULT_SLA_POLICY;
    try {
      const { data: slaPolicyRow } = await supabase
        .from('sla_policies')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (slaPolicyRow) {
        slaPolicy = {
          ...DEFAULT_SLA_POLICY,
          first_contact_minutes: slaPolicyRow.first_contact_minutes ?? DEFAULT_SLA_POLICY.first_contact_minutes,
          grouping_window_minutes: slaPolicyRow.grouping_window_minutes ?? DEFAULT_SLA_POLICY.grouping_window_minutes,
          escalate_after_returns: slaPolicyRow.escalate_after_returns ?? DEFAULT_SLA_POLICY.escalate_after_returns,
          hard_escalate_minutes: slaPolicyRow.hard_escalate_minutes ?? DEFAULT_SLA_POLICY.hard_escalate_minutes,
          timezone: slaPolicyRow.timezone ?? DEFAULT_SLA_POLICY.timezone,
          work_schedule: slaPolicyRow.work_schedule ?? DEFAULT_SLA_POLICY.work_schedule,
          holidays: slaPolicyRow.holidays ?? [],
        };
      }
    } catch { /* tabela pode não existir — usar default */ }

    // ── Calcular SLA quando aplicável ─────────────────────────────────────────
    let slaStatus = null;
    if (lead.sent_to_seller_at || lead.assigned_at) {
      const assignedAt = new Date(lead.assigned_at || lead.sent_to_seller_at);
      slaStatus = computeSlaStatus(assignedAt, new Date(), slaPolicy);
    }

    // ── Recuperar histórico recente das interações ────────────────────────────
    const { data: historyData } = await supabase
      .from('interactions')
      .select('sender_type, message_content, created_at')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(20);

    const history = (historyData || []).reverse();

    // ── Gravar mensagem do cliente no histórico ───────────────────────────────
    await supabase.from('interactions').insert([{
      lead_id: lead.id,
      sender_type: 'CUSTOMER',
      message_content: event.body,
    }]);

    // ── Verificar janela de agrupamento de retornos (15 min) ──────────────────
    const lastCustomerMsg = history.slice().reverse().find(m =>
      m.sender_type === 'CUSTOMER' || m.sender_type === 'lead' || m.sender_type === 'user'
    );
    const withinGroupingWindow = lastCustomerMsg
      ? isWithinGroupingWindow(new Date(lastCustomerMsg.created_at), new Date(), slaPolicy)
      : false;

    // ── Triagem determinística: SDR / SUPORTE / PÓS-VENDA ─────────────────────
    const decision = classifyReturnIntent(event.body, lead);

    let resposta = '';

    if (decision.mode === 'POS_VENDA') {
      // ── PÓS-VENDA ────────────────────────────────────────────────────────────
      const posResult = await processPostSaleMessage(history, lead.id);
      resposta = posResult.resposta_whatsapp;

      // Não alterar status do pipeline comercial por mensagem ambígua com "pedido"
      // Apenas abrir ticket ORDER_VERIFICATION se ainda não existe
      await ensurePostSaleTicket(lead.id, event.tenantId);

    } else if (decision.mode === 'SUPORTE') {
      // ── SUPORTE DE ATENDIMENTO ────────────────────────────────────────────────
      if (withinGroupingWindow) {
        // Janela de 15 min: atualizar ticket existente sem nova rodada completa
        await updateExistingTicketReturn(lead.id, event.body);
        console.log(`[Orchestrator] Retorno agrupado na janela de 15min para lead ${lead.id}`);
        return;
      }

      const supportResult = await handleSupportReturn(lead, history, slaStatus, slaPolicy, event);
      resposta = supportResult.message;

    } else {
      // ── SDR ───────────────────────────────────────────────────────────────────
      const sdrResult = await processLeadWithSkills(history, lead.id);
      if (sdrResult && !sdrResult.erro_openai) {
        resposta = sdrResult.resposta_whatsapp;
        await updateLeadFromSdrResult(lead, sdrResult, event.tenantId);

        if (sdrResult.qualificacao_concluida) {
          await routeLead(lead.id, lead.tenant_id || event.tenantId || '', {
            produto: sdrResult.demanda?.produto_normalizado || lead.produto,
            quantidade: sdrResult.demanda?.quantidade_metragem || lead.quantidade,
            especificacao: (sdrResult.demanda as any)?.especificacao_tecnica_completa || lead.especificacao,
            nome_cliente: sdrResult.cliente?.nome || lead.name,
            empresa: sdrResult.cliente?.empresa || lead.company,
            cnpj: sdrResult.cliente?.cnpj || lead.cnpj,
            email: sdrResult.cliente?.email || lead.email_corporativo,
            cidade: sdrResult.cliente?.cidade || lead.cidade_empresa,
            segmento_detectado: sdrResult.demanda?.segmento_detectado || 'Indústria',
            resumo: sdrResult.demanda?.resumo_executivo || lead.observacao,
          });
        }
      }
    }

    // ── Enviar resposta ao cliente via dispatcher ────────────────────────────
    if (resposta) {
      await supabase.from('interactions').insert([{
        lead_id: lead.id,
        sender_type: 'LINO',
        message_content: resposta,
      }]);

      await dispatch({
        toPhone: event.fromNumber,
        logicalRole: 'CUSTOMER',
        body: resposta,
        eventType: `${decision.mode}_REPLY`,
        correlationLeadId: lead.id,
        tenantId: event.tenantId,
      });
    }

    // ── Marcar inbound como processado ───────────────────────────────────────
    if (event.externalMessageId) {
      try {
        await supabase
          .from('inbound_messages')
          .update({ status: 'processed', processed_at: new Date().toISOString() })
          .eq('external_message_id', event.externalMessageId);
      } catch {}
    }

  } catch (err: any) {
    console.error('[Orchestrator] Erro no processamento:', err.message);
    if (event.externalMessageId) {
      try {
        await supabase
          .from('inbound_messages')
          .update({ status: 'error', error: err.message })
          .eq('external_message_id', event.externalMessageId);
      } catch {}
    }
  }
}

// ─── Helpers internos ────────────────────────────────────────────────────────

/**
 * Verifica se o número pertence a um colaborador (vendedor/supervisor/admin).
 * Colaboradores respondem às notificações do Lino — não devem criar leads.
 */
async function checkIfCollaborator(normalizedPhone: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('admin_users')
      .select('id')
      .or(`whatsapp_number.eq.${normalizedPhone},whatsapp_number.eq.${normalizedPhone.slice(2)}`)
      .limit(1)
      .maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}

/**
 * Processa a resposta de um colaborador (vendedor/supervisor) às notificações do Lino.
 * Correlaciona pelo número do remetente e ticket/atendimento aberto.
 */
async function processSellerResponse(
  sellerPhone: string,
  message: string,
  tenantId?: string
): Promise<void> {
  // Buscar vendedor pelo telefone
  const { data: seller } = await supabase
    .from('admin_users')
    .select('id, name')
    .or(`whatsapp_number.eq.${sellerPhone},whatsapp_number.eq.${sellerPhone.slice(2)}`)
    .limit(1)
    .maybeSingle();

  if (!seller) return;

  // Buscar lead ativo atribuído a este vendedor
  const { data: lead } = await supabase
    .from('leads')
    .select('id, name, tracking_code')
    .eq('current_owner_id', seller.id)
    .in('status', ['WAITING_SELLER', 'IN_NEGOTIATION'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lead) return;

  // Registrar evento de resposta do vendedor
  const responseUpper = message.trim().toUpperCase();
  let eventType = 'seller.message_received';

  if (/recebi|acknowledged/i.test(message)) {
    eventType = 'assignment.accepted';
    await supabase.from('leads').update({ seller_acknowledged_at: new Date().toISOString() }).eq('id', lead.id);
  } else if (/contato realizado|entrei em contato|já falei|liguei/i.test(message)) {
    eventType = 'seller.contact_recorded';
    await supabase.from('leads').update({ seller_contacted_at: new Date().toISOString() }).eq('id', lead.id);
  } else if (/orçamento enviado|proposta enviada|mandei o orçamento/i.test(message)) {
    eventType = 'quote.sent';
    await supabase.from('leads').update({
      quote_sent_at: new Date().toISOString(),
      status: 'IN_NEGOTIATION',
    }).eq('id', lead.id);
  }

  // Registrar na timeline de eventos
  try {
    await supabase.from('conversation_events').insert([{
      tenant_id: tenantId,
      lead_id: lead.id,
      event_type: eventType,
      actor_type: 'SELLER',
      actor_id: seller.id,
      payload: { message, raw: responseUpper },
    }]);
  } catch {}

  console.log(`[Orchestrator] Resposta do vendedor ${seller.name} registrada: ${eventType}`);
}

/**
 * Processa o retorno do cliente no fluxo de suporte de atendimento.
 * Abre ou atualiza ticket, calcula SLA e constrói resposta baseada em ações reais.
 */
async function handleSupportReturn(
  lead: any,
  history: any[],
  slaStatus: any,
  slaPolicy: any,
  event: InboundEvent
): Promise<{ message: string; action: string }> {
  const now = new Date();

  // Contar retornos anteriores
  const { count: returnCount } = await supabase
    .from('conversation_events')
    .select('id', { count: 'exact' })
    .eq('lead_id', lead.id)
    .eq('event_type', 'customer.returned')
    .returns<{ count: number }>();

  const currentReturnCount = (returnCount || 0) + 1;

  // Registrar retorno do cliente
  try {
    await supabase.from('conversation_events').insert([{
      tenant_id: event.tenantId,
      lead_id: lead.id,
      event_type: 'customer.returned',
      actor_type: 'CUSTOMER',
      payload: {
        message: event.body,
        return_count: currentReturnCount,
        business_minutes_elapsed: slaStatus?.business_minutes_elapsed,
        sla_state: slaStatus?.state,
      },
    }]);
  } catch {}

  // Abrir/atualizar ticket de suporte
  const { data: existingTicket } = await supabase
    .from('service_tickets')
    .select('id, status, return_count')
    .eq('lead_id', lead.id)
    .eq('flow', 'ATTENDANCE_SUPPORT')
    .not('status', 'in', '("RESOLVED","CLOSED")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let ticketId: string | null = existingTicket?.id ?? null;
  const isSlaBreach = slaStatus?.state === 'BREACHED';
  const isUrgent = /urgent|urgente|preciso|hoje|prazo|ontem|sem resposta/i.test(event.body);

  if (!existingTicket) {
    const { data: newTicket } = await supabase
      .from('service_tickets')
      .insert([{
        tenant_id: event.tenantId,
        lead_id: lead.id,
        flow: 'ATTENDANCE_SUPPORT',
        category: 'NO_FIRST_CONTACT',
        status: 'OPEN',
        priority: isUrgent ? 'URGENT' : isSlaBreach ? 'HIGH' : 'NORMAL',
        assigned_to: lead.current_owner_id,
        sla_due_at: slaStatus?.first_contact_due_at?.toISOString(),
        sla_breached: isSlaBreach,
      }])
      .select('id')
      .single();
    ticketId = newTicket?.id ?? null;

    // Registrar evento de abertura de ticket
    if (ticketId) {
      try {
        await supabase.from('conversation_events').insert([{
          tenant_id: event.tenantId,
          lead_id: lead.id,
          ticket_id: ticketId,
          event_type: 'ticket.created',
          actor_type: 'LINO',
          payload: { flow: 'ATTENDANCE_SUPPORT', category: 'NO_FIRST_CONTACT', return_count: currentReturnCount },
        }]);
      } catch {}
    }
  } else {
    // Atualizar ticket existente
    const updates: any = { updated_at: now.toISOString() };
    if (isSlaBreach) updates.sla_breached = true;
    if (isUrgent) updates.priority = 'URGENT';
    try {
      await supabase.from('service_tickets').update(updates).eq('id', existingTicket.id);
    } catch {}
  }

  // Verificar escalada dura
  const shouldHardEscalate = slaStatus && (
    slaStatus.business_minutes_elapsed >= slaPolicy.hard_escalate_minutes ||
    currentReturnCount >= slaPolicy.escalate_after_returns
  );

  let escalationExecuted = false;
  if (shouldHardEscalate && lead.current_owner_id) {
    const { data: owner } = await supabase
      .from('admin_users')
      .select('name, team_id')
      .eq('id', lead.current_owner_id)
      .maybeSingle();

    if (owner?.team_id) {
      const { data: team } = await supabase
        .from('teams')
        .select('supervisor_phone, supervisor_name, manager_id')
        .eq('id', owner.team_id)
        .maybeSingle();

      const supervisorPhone = team?.supervisor_phone;
      const supervisorName = team?.supervisor_name || 'Coordenação';

      if (supervisorPhone) {
        const escalateResult = await dispatch({
          toPhone: supervisorPhone,
          logicalRole: 'SUPERVISOR',
          logicalName: supervisorName,
          body: `🚨 *LINO — Escalação Urgente*\n\nAtendimento LINO.${(lead.tracking_code || lead.id).slice(-6).toUpperCase()} está sem retorno.\nCliente: ${lead.name || 'N/D'}\nRetornos: ${currentReturnCount}x\nMinutos úteis decorridos: ${slaStatus.business_minutes_elapsed}\n\nAção imediata necessária.`,
          eventType: 'SUPERVISOR_ESCALATION',
          idempotencyKey: `escalation-${lead.id}-return-${currentReturnCount}`,
          correlationLeadId: lead.id,
        });

        if (escalateResult.sent || escalateResult.blocked) {
          escalationExecuted = true;
          try {
            await supabase.from('conversation_events').insert([{
              tenant_id: event.tenantId,
              lead_id: lead.id,
              ticket_id: ticketId,
              event_type: 'ticket.escalated',
              actor_type: 'LINO',
              payload: { return_count: currentReturnCount, minutes_elapsed: slaStatus.business_minutes_elapsed },
            }]);
          } catch {}
        }
      }
    }
  }

  // Notificar vendedor (se ainda não escalou definitivamente)
  let sellerNotified = false;
  if (!shouldHardEscalate && lead.current_owner_id) {
    const { data: seller } = await supabase
      .from('admin_users')
      .select('name, whatsapp_number')
      .eq('id', lead.current_owner_id)
      .maybeSingle();

    if (seller?.whatsapp_number) {
      const ticketCode = lead.tracking_code || `LINO.${lead.id.split('-')[0].toUpperCase()}`;
      const urgencyNote = isUrgent ? '\n⚡ *URGENTE — cliente tem prazo para hoje.*' : '';
      const slaNote = isSlaBreach ? `\n⚠️ SLA violado: ${slaStatus.business_minutes_elapsed} min úteis decorridos.` : '';

      const notifResult = await dispatch({
        toPhone: seller.whatsapp_number,
        logicalRole: 'SELLER',
        logicalName: seller.name,
        body: `🔔 *LINO — Retorno de Cliente*\n\nAtendimento ${ticketCode}${slaNote}${urgencyNote}\nCliente: ${lead.name || 'N/D'}\n\nO cliente voltou a cobrar atendimento (${currentReturnCount}ª vez).\n\nResponda: *Contato realizado* | *Orçamento enviado* | *Transferir* | *Informar impedimento*`,
        eventType: 'SELLER_RETURN_NOTIFICATION',
        idempotencyKey: `seller-return-${lead.id}-${currentReturnCount}`,
        correlationLeadId: lead.id,
      });
      sellerNotified = notifResult.sent || notifResult.blocked;
    }
  }

  // Compor resposta verdadeira ao cliente baseada nas ações executadas
  const { data: interactionData } = await supabase
    .from('interactions')
    .select('sender_type, message_content')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const supportAiResult = await generateSupportResponse(lead, (interactionData || []).reverse(), {
    sla_state: slaStatus?.state,
    business_minutes_elapsed: slaStatus?.business_minutes_elapsed,
    return_count: currentReturnCount,
    seller_notified: sellerNotified,
    escalation_executed: escalationExecuted,
    is_urgent: isUrgent,
  } as any);

  return {
    message: supportAiResult.resposta || supportAiResult.message || 'Registrei seu retorno e acionei o responsável pelo seu atendimento.',
    action: escalationExecuted ? 'ESCALATED' : sellerNotified ? 'SELLER_NOTIFIED' : 'RECORDED',
  };
}

/**
 * Garante que existe um ticket de ORDER_VERIFICATION para pós-venda sem pedido identificado.
 */
async function ensurePostSaleTicket(leadId: string, tenantId?: string): Promise<void> {
  const { data: existing } = await supabase
    .from('service_tickets')
    .select('id')
    .eq('lead_id', leadId)
    .eq('flow', 'POST_SALE')
    .not('status', 'in', '("RESOLVED","CLOSED")')
    .limit(1)
    .maybeSingle();

  if (!existing) {
    try {
      await supabase.from('service_tickets').insert([{
        tenant_id: tenantId,
        lead_id: leadId,
        flow: 'POST_SALE',
        category: 'ORDER_VERIFICATION',
        status: 'PENDING_CUSTOMER',
        priority: 'NORMAL',
      }]);
    } catch {}
  }
}

/**
 * Atualiza o ticket na janela de agrupamento de retornos (15 min).
 * Não dispara nova rodada completa — apenas registra o evento.
 */
async function updateExistingTicketReturn(leadId: string, message: string): Promise<void> {
  try {
    await supabase.from('conversation_events').insert([{
      lead_id: leadId,
      event_type: 'customer.returned',
      actor_type: 'CUSTOMER',
      payload: { message, grouped: true },
    }]);
  } catch {}
}

/**
 * Atualiza dados do lead com resultado do SDR.
 */
async function updateLeadFromSdrResult(lead: any, aiResult: any, tenantId?: string): Promise<void> {
  const update: any = {
    updated_at: new Date().toISOString(),
    b2b_attempts: aiResult.b2b_attempts || lead.b2b_attempts,
  };

  if (aiResult.cliente?.nome) update.name = aiResult.cliente.nome;
  if (aiResult.cliente?.empresa) { update.company = aiResult.cliente.empresa; update.empresa = aiResult.cliente.empresa; }
  if (aiResult.cliente?.cnpj) update.cnpj = aiResult.cliente.cnpj;
  if (aiResult.cliente?.email) update.email_corporativo = aiResult.cliente.email;
  if (aiResult.cliente?.cidade) update.cidade_empresa = aiResult.cliente.cidade;
  if (aiResult.demanda?.produto_normalizado) { update.detected_product = aiResult.demanda.produto_normalizado; update.produto = aiResult.demanda.produto_normalizado; }
  if (aiResult.demanda?.quantidade_metragem) update.quantidade = aiResult.demanda.quantidade_metragem;
  if ((aiResult.demanda as any)?.especificacao_tecnica_completa) {
    update.especificacao = (aiResult.demanda as any).especificacao_tecnica_completa;
  } else if (aiResult.demanda?.dimensoes) {
    update.especificacao = aiResult.demanda.dimensoes;
  }
  if (aiResult.demanda?.resumo_executivo) update.observacao = aiResult.demanda.resumo_executivo;
  if (aiResult.demanda?.segmento_detectado) {
    update.qualification_state = { ...(lead.qualification_state || {}), segmento: aiResult.demanda.segmento_detectado };
  }
  if (aiResult.qualificacao_concluida) {
    update.status = 'WAITING_SELLER';
    update.qualification_completed = true;
    update.qualified_at = new Date().toISOString();
  }

  try {
    await supabase.from('leads').update(update).eq('id', lead.id);
  } catch (err: any) {
    console.error('[Orchestrator] Erro ao atualizar lead SDR:', err?.message || err);
  }
}
