import { supabase } from './supabase';
import {
  notifySellerAboutLead,
  notifySupervisor,
  checkSellerStartedConversation,
} from './evolution-api';

/**
 * LINO SUPORTE — Motor de Monitoramento de Atendimento
 *
 * Regras:
 * - 1ª notificação: imediata (ao atribuir lead)
 * - 2ª notificação: 40 min sem resposta
 * - 3ª notificação: 80 min sem resposta
 * - Escalar supervisor: 120 min (2h) sem resposta
 *
 * A cada ciclo (rodado pelo cron a cada 5 min), verifica todos os leads
 * em status WAITING_SELLER e aplica as regras de follow-up.
 */

// Tempos em minutos para cada tentativa de notificação
const FOLLOW_UP_SCHEDULE = [
  { attempt: 1, afterMinutes: 0 },     // Imediata
  { attempt: 2, afterMinutes: 40 },    // 40 min
  { attempt: 3, afterMinutes: 80 },    // 1h20
];
const ESCALATION_MINUTES = 120; // 2h → escalar supervisor

/**
 * Função principal do Lino Suporte.
 * Deve ser chamada periodicamente (a cada 5 min) pelo cron.
 */
export async function runSupportMonitor(): Promise<{
  checked: number;
  notified: number;
  escalated: number;
  resolved: number;
  errors: string[];
}> {
  const result = { checked: 0, notified: 0, escalated: 0, resolved: 0, errors: [] as string[] };

  try {
    // 1. Buscar todos os leads aguardando vendedor
    const { data: pendingLeads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('status', 'WAITING_SELLER');

    if (leadsError) {
      result.errors.push(`Erro ao buscar leads: ${leadsError.message}`);
      return result;
    }

    if (!pendingLeads || pendingLeads.length === 0) {
      console.log('[Lino Suporte] Nenhum lead pendente de atendimento.');
      return result;
    }

    result.checked = pendingLeads.length;
    console.log(`[Lino Suporte] ${pendingLeads.length} leads aguardando vendedor...`);

    for (const lead of pendingLeads) {
      try {
        await processLead(lead, result);
      } catch (err: any) {
        result.errors.push(`Erro processando lead ${lead.id}: ${err.message}`);
      }
    }
  } catch (err: any) {
    result.errors.push(`Erro geral no monitor: ${err.message}`);
  }

  console.log(`[Lino Suporte] Ciclo finalizado:`, result);
  return result;
}

/**
 * Processa um lead individual — verifica se vendedor respondeu, notifica ou escala.
 */
async function processLead(
  lead: any,
  result: { notified: number; escalated: number; resolved: number; errors: string[] }
) {
  const leadId = lead.id;
  const assignedUserId = lead.current_owner_id;
  const leadPhone = lead.whatsapp_number || '';
  const leadName = lead.name || 'Lead sem nome';

  if (!assignedUserId) {
    console.log(`[Lino Suporte] Lead ${leadId} sem vendedor atribuído. Ignorando.`);
    return;
  }

  // Tempo desde que o lead entrou em WAITING_SELLER
  const waitingSince = new Date(lead.updated_at || lead.created_at);
  const minutesWaiting = (Date.now() - waitingSince.getTime()) / 60000;

  // Buscar dados do vendedor
  const { data: seller } = await supabase
    .from('admin_users')
    .select('*, teams(supervisor_name, supervisor_phone, supervisor_email)')
    .eq('id', assignedUserId)
    .single();

  if (!seller) {
    result.errors.push(`Vendedor ${assignedUserId} não encontrado para lead ${leadId}`);
    return;
  }

  // Verificar se vendedor já iniciou conversa com o lead
  const sellerStarted = await checkSellerStartedConversation(assignedUserId, leadPhone);

  if (sellerStarted) {
    // Vendedor respondeu! Atualizar status do lead
    console.log(`[Lino Suporte] ✅ Vendedor ${seller.name} já está atendendo lead ${leadName}`);
    await supabase
      .from('leads')
      .update({ status: 'IN_NEGOTIATION', updated_at: new Date().toISOString() })
      .eq('id', leadId);

    // Marcar follow-ups como resolvidos
    await supabase
      .from('lead_follow_ups')
      .update({ responded: true, response_detected_at: new Date().toISOString(), status: 'RESOLVED' })
      .eq('lead_id', leadId)
      .eq('responded', false);

    result.resolved++;
    return;
  }

  // Buscar follow-ups já enviados para este lead
  const { data: followUps } = await supabase
    .from('lead_follow_ups')
    .select('*')
    .eq('lead_id', leadId)
    .order('attempt_number', { ascending: true });

  const existingAttempts = followUps?.length || 0;
  const lastAttempt = followUps?.[followUps.length - 1];

  // Verificar se já foi escalado
  if (lastAttempt?.escalated_to_supervisor) {
    console.log(`[Lino Suporte] Lead ${leadName} já foi escalado ao supervisor. Ignorando.`);
    return;
  }

  // Buscar telefone do vendedor via instância
  const { data: sellerInstance } = await supabase
    .from('instances')
    .select('phone_number')
    .eq('assigned_user_id', assignedUserId)
    .eq('active', true)
    .limit(1)
    .single();

  const sellerPhone = sellerInstance?.phone_number || '';

  if (!sellerPhone) {
    result.errors.push(`Sem telefone para vendedor ${seller.name} (lead ${leadName})`);
    return;
  }

  // === LÓGICA DE ESCALONAMENTO ===

  // Verificar se precisa escalar ao supervisor (2h+)
  if (minutesWaiting >= ESCALATION_MINUTES && existingAttempts >= 3) {
    const supervisorData = seller.teams;
    const supervisorPhone = supervisorData?.supervisor_phone;

    if (supervisorPhone) {
      const sent = await notifySupervisor(
        supervisorPhone,
        seller.name,
        leadName,
        leadPhone
      );

      if (sent) {
        // Registrar escalação
        await supabase.from('lead_follow_ups').insert([{
          lead_id: leadId,
          assigned_user_id: assignedUserId,
          team_id: seller.team_id,
          attempt_number: existingAttempts + 1,
          escalated_to_supervisor: true,
          escalated_at: new Date().toISOString(),
          status: 'ESCALATED',
        }]);

        console.log(`[Lino Suporte] 🚨 Lead ${leadName} ESCALADO para supervisor ${supervisorData.supervisor_name}`);
        result.escalated++;
      }
    } else {
      result.errors.push(`Sem supervisor configurado para equipe do vendedor ${seller.name}`);
    }
    return;
  }

  // Verificar próxima notificação a enviar
  for (const schedule of FOLLOW_UP_SCHEDULE) {
    if (existingAttempts >= schedule.attempt) continue;
    if (minutesWaiting < schedule.afterMinutes) continue;

    // Hora de enviar esta notificação
    const sent = await notifySellerAboutLead(
      sellerPhone,
      leadName,
      leadPhone,
      schedule.attempt
    );

    if (sent) {
      await supabase.from('lead_follow_ups').insert([{
        lead_id: leadId,
        assigned_user_id: assignedUserId,
        team_id: seller.team_id,
        attempt_number: schedule.attempt,
        status: 'NOTIFIED',
      }]);

      console.log(`[Lino Suporte] 📩 Notificação #${schedule.attempt} enviada para ${seller.name} sobre lead ${leadName}`);
      result.notified++;
    }

    // Só envia uma notificação por ciclo por lead
    break;
  }
}

/**
 * NOVA FUNÇÃO: HandleClientReturn determinístico
 * Quando o lead volta a falar, consultamos o estado REAL no banco
 * e decidimos a ação baseada no status atual.
 */
export async function handleClientReturn(
  whatsappNumber: string, 
  message: string
): Promise<{
  action: string;
  message: string;
  leadData?: any;
}> {
  console.log(`[Lino Suporte] 🔍 Processando retorno do cliente ${whatsappNumber}`);

  // 1. Buscar lead pelo WhatsApp
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select(`
      *,
      current_owner:admin_users(name, whatsapp_number, team_id, teams(supervisor_name, supervisor_phone))
    `)
    .eq('whatsapp_number', whatsappNumber)
    .single();

  if (leadError || !lead) {
    console.log('[Lino Suporte] Lead não encontrado — novo lead');
    return { 
      action: 'NEW_LEAD', 
      message: 'Olá! Vou te ajudar. Para começar, me conta o que você precisa?' 
    };
  }

  // 2. Calcular tempo desde envio ao vendedor
  const sentTime = lead.sent_to_seller_at || lead.updated_at;
  const hoursSinceSent = (Date.now() - new Date(sentTime).getTime()) / 3600000;

  // 3. Verificar tentativas de retorno anteriores
  const { data: returnAttempts } = await supabase
    .from('lead_follow_ups')
    .select('*')
    .eq('lead_id', lead.id)
    .eq('status', 'CLIENT_RETURNED')
    .order('created_at', { ascending: false });

  const returnCount = returnAttempts?.length || 0;
  const lastReturn = returnAttempts?.[0];
  
  // Reutilizar slot se < 20 minutos da última mensagem do cliente
  const twentyMinutesAgo = Date.now() - 20 * 60000;
  const isRecentReturn = lastReturn?.last_client_message_at && 
    new Date(lastReturn.last_client_message_at).getTime() > twentyMinutesAgo;

  // 4. Verificar se vendedor iniciou conversa (Evolution API)
  let sellerResponded = false;
  if (lead.current_owner_id) {
    sellerResponded = await checkSellerStartedConversation(
      lead.current_owner_id, 
      whatsappNumber
    );
  }

  // 5. Registrar gargalo com lino-support-fiscalization
  const bottleneckResult = await registerBottleneckIfNeeded(
    lead, 
    sellerResponded, 
    hoursSinceSent, 
    returnCount
  );

  // 6. Decidir ação por status atual
  const action = await decideActionByStatus(
    lead, 
    sellerResponded, 
    hoursSinceSent, 
    returnCount,
    isRecentReturn
  );

  // 7. Registrar tentativa de retorno (se não for recente)
  if (!isRecentReturn) {
    await registerClientReturn(lead.id, lead.current_owner_id, returnCount + 1, hoursSinceSent);
  }

  console.log(`[Lino Suporte] 📊 Ação decided: ${action.action}, Retornos: ${returnCount}, Vendedor respondeu: ${sellerResponded}`);

  return {
    ...action,
    leadData: lead
  };
}

/**
 * Decide a ação baseada no status real do lead
 * Também dispara notificações ao vendedor quando necessário
 */
async function decideActionByStatus(
  lead: any,
  sellerResponded: boolean,
  hoursSinceSent: number,
  returnCount: number,
  isRecentReturn: boolean
): Promise<{ action: string; message: string }> {
  
  const status = lead.status;

  // Se o cliente está em qualificação (SDR ainda não terminou)
  if (status === 'SDR_QUALIFICATION' || status === 'QUALIFIED') {
    return {
      action: 'CONTINUE_QUALIFICATION',
      message: 'Entendi! Deixe-me continuar com as informações que precisamos.'
    };
  }

  // Se está aguardando vendedor
  if (status === 'WAITING_SELLER' || status === 'SENT_TO_SELLER') {
    
    // Vendedor NÃO iniciou conversa ainda
    if (!sellerResponded) {
      
      // 3+ retornos sem resposta = escalar supervisor
      if (returnCount >= 3) {
        // Notificar supervisor urgentemente
        await notifySupervisorUrgent(lead);
        return {
          action: 'ESCALATE_SUPERVISOR',
          message: 'Entendo sua urgência. Vou acionar nosso supervisor para verificar o que aconteceu.'
        };
      }

      // Retornos anteriores - cobrar vendedor urgentemente
      if (returnCount >= 1) {
        await notifySellerUrgent(lead, returnCount);
        return {
          action: 'NOTIFY_SELLER_URGENT',
          message: 'Entendo sua urgência. Já notifiquei novamente o vendedor. Vou acompanhar.'
        };
      }

      // Primeiro retorno - notificar vendedor
      await notifySellerAboutLead(
        lead.current_owner?.users?.phone_number || '',
        lead.name || 'Lead',
        lead.whatsapp_number || '',
        3 // Mensagem de urgência
      );
      return {
        action: 'NOTIFY_SELLER',
        message: 'Obrigado por entrar em contato. Vou verificar o andamento do seu pedido com o vendedor.'
      };
    }

    // Vendedor iniciou mas não confirmou recebimento no sistema
    if (status === 'SENT_TO_SELLER' && sellerResponded) {
      // Atualizar status para SELLER_RECEIVED
      await supabase.from('leads').update({
        status: 'SELLER_RECEIVED',
        seller_confirmed_at: new Date().toISOString()
      }).eq('id', lead.id);
      
      // Registrar no histórico
      await registerStatusHistory(lead.id, 'SENT_TO_SELLER', 'SELLER_RECEIVED', 'system');

      return {
        action: 'SELLER_CONFIRMED',
        message: 'O vendedor confirmou o recebimento. Vou verificar se ele já iniciou o atendimento.'
      };
    }
  }

  // Vendedor confirmou mas não iniciou atendimento
  if (status === 'SELLER_RECEIVED') {
    return {
      action: 'CHECK_ATTENDANCE_STARTED',
      message: 'O vendedor recebeu seu contato. Vou verificar se ele já iniciou o atendimento.'
    };
  }

  // Atendimento já começou - direcionar para o vendedor
  if (status === 'ATTENDANCE_STARTED' || status === 'IN_NEGOTIATION') {
    return {
      action: 'FORWARD_TO_SELLER',
      message: 'Deixe-me direcionar você ao vendedor que estava atendendo.'
    };
  }

  // Aguardando orçamento
  if (status === 'AWAITING_QUOTE' || status === 'QUOTE_SENT') {
    return {
      action: 'CHECK_QUOTE_STATUS',
      message: 'Vou verificar o status do seu orçamento.'
    };
  }

  // Cliente cobrindo (já ouviu do vendedor, mas ainda precisa de algo)
  if (status === 'CLIENT_COBRING') {
    return {
      action: 'CLIENT_COBRING',
      message: 'Entendo. Vou verificar o que está pendente.'
    };
  }

  // Já escalado para supervisor
  if (status === 'ESCALATED_TO_SUPERVISOR') {
    return {
      action: 'SUPERVISOR_ESCALATED',
      message: 'Seu caso já está com o supervisor. Vou verificar o andamento.'
    };
  }

  // Default - resposta genérica baseada no contexto
  return {
    action: 'GENERIC_RESPONSE',
    message: 'Obrigado por entrar em contato. Vou verificar sua situação.'
  };
}

/**
 * Notifica vendedor urgentemente (para retornos do cliente)
 */
async function notifySellerUrgent(lead: any, returnCount: number): Promise<void> {
  if (!lead.current_owner_id) return;

  const { data: sellerInstance } = await supabase
    .from('instances')
    .select('phone_number')
    .eq('assigned_user_id', lead.current_owner_id)
    .eq('active', true)
    .limit(1)
    .single();

  if (sellerInstance?.phone_number) {
    const urgentMsg = returnCount >= 2 
      ? `🚨 URGENTE! Cliente retornou ${returnCount}x sem resposta. Por favor, atende agora!`
      : `⚠️ Cliente entrou em contato novamente. Por favor, atende!`;

    await notifySellerAboutLead(
      sellerInstance.phone_number,
      lead.name || 'Lead',
      lead.whatsapp_number || '',
      3
    );
  }
}

/**
 * Notifica supervisor urgentemente (quando vendedor não atende após múltiplas tentativas)
 */
async function notifySupervisorUrgent(lead: any): Promise<void> {
  if (!lead.current_owner?.teams?.supervisor_phone) return;

  await notifySupervisor(
    lead.current_owner.teams.supervisor_phone,
    lead.current_owner?.name || 'Vendedor',
    lead.name || 'Lead',
    lead.whatsapp_number || ''
  );

  // Registrar escalação
  await supabase.from('supervisor_escalations').insert([{
    lead_id: lead.id,
    user_id: lead.current_owner_id,
    team_id: lead.current_owner?.team_id,
    escalation_reason: 'Cliente voltou 3x sem resposta do vendedor'
  }]);

  // Atualizar status para escalado
  await supabase.from('leads').update({
    status: 'ESCALATED_TO_SUPERVISOR'
  }).eq('id', lead.id);
}

/**
 * Registra gargalo se vendedor não respondeu (lino-support-fiscalization)
 */
async function registerBottleneckIfNeeded(
  lead: any,
  sellerResponded: boolean,
  hoursSinceSent: number,
  returnCount: number
): Promise<boolean> {
  if (sellerResponded || !lead.current_owner_id) return false;

  const type = returnCount > 0 ? 'CLIENT_RETURNED' : 'NO_RESPONSE';
  const severity = hoursSinceSent > 2 ? 'critical' : hoursSinceSent > 1 ? 'high' : 'medium';

  const description = returnCount > 0 
    ? `Cliente voltou ${returnCount}x sem resposta do vendedor (${hoursSinceSent.toFixed(1)}h)`
    : `Vendedor não iniciou contato há ${hoursSinceSent.toFixed(1)}h`;

  const { error } = await supabase.from('attendance_bottlenecks').insert([{
    lead_id: lead.id,
    bottleneck_type: type,
    severity: severity,
    description: description,
    hours_waited: hoursSinceSent
  }]);

  if (error) {
    console.error('[Lino Suporte] Erro ao registrar gargalo:', error);
    return false;
  }

  console.log(`[Lino Suporte] ⚠️ Gargalo registrado: ${type} - ${severity}`);
  return true;
}

/**
 * Registra tentativa de retorno do cliente
 */
async function registerClientReturn(
  leadId: string,
  userId: string | null,
  count: number,
  hoursSinceSent: number
): Promise<void> {
  await supabase.from('lead_follow_ups').insert([{
    lead_id: leadId,
    assigned_user_id: userId,
    attempt_number: 0,
    status: 'CLIENT_RETURNED',
    client_return_count: count,
    last_client_message_at: new Date().toISOString(),
    time_since_sent_hours: hoursSinceSent
  }]);
}

/**
 * Registra mudança de status no histórico
 */
async function registerStatusHistory(
  leadId: string,
  fromStatus: string,
  toStatus: string,
  changedBy: string
): Promise<void> {
  await supabase.from('lead_status_history').insert([{
    lead_id: leadId,
    from_status: fromStatus,
    to_status: toStatus,
    changed_by: changedBy === 'system' ? null : changedBy,
    reason: `Mudança automática via Lino Suporte`
  }]);
}

/**
 * Função para atualizar status do lead e enviar notificação quando necessário
 */
export async function updateLeadStatus(
  leadId: string,
  newStatus: string,
  reason?: string
): Promise<void> {
  const { data: lead } = await supabase
    .from('leads')
    .select('status')
    .eq('id', leadId)
    .single();

  if (!lead || lead.status === newStatus) return;

  // Atualizar status
  const updateData: any = { 
    status: newStatus,
    updated_at: new Date().toISOString()
  };

  // Timestamps baseados no status
  if (newStatus === 'SENT_TO_SELLER') {
    updateData.sent_to_seller_at = new Date().toISOString();
  } else if (newStatus === 'SELLER_RECEIVED') {
    updateData.seller_confirmed_at = new Date().toISOString();
  } else if (newStatus === 'ATTENDANCE_STARTED') {
    updateData.attendance_started_at = new Date().toISOString();
  }

  await supabase.from('leads').update(updateData).eq('id', leadId);

  // Registrar no histórico
  await registerStatusHistory(leadId, lead.status, newStatus, 'system');

  console.log(`[Lino Suporte] 📝 Lead ${leadId} atualizado: ${lead.status} → ${newStatus}`);
}

/**
 * Escala para supervisor quando necessário
 */
export async function escalateToSupervisor(
  leadId: string,
  reason: string
): Promise<void> {
  const { data: lead } = await supabase
    .from('leads')
    .select('*, current_owner:users(name, team_id, teams(supervisor_name, supervisor_phone))')
    .eq('id', leadId)
    .single();

  if (!lead) return;

  // Atualizar status
  await updateLeadStatus(leadId, 'ESCALATED_TO_SUPERVISOR');

  // Buscar telefone do supervisor
  const supervisorPhone = lead.current_owner?.teams?.supervisor_phone;
  
  if (supervisorPhone) {
    await notifySupervisor(
      supervisorPhone,
      lead.current_owner?.name || 'Vendedor',
      lead.name || 'Lead',
      lead.whatsapp_number || ''
    );
  }

  // Registrar escalação
  await supabase.from('supervisor_escalations').insert([{
    lead_id: leadId,
    user_id: lead.current_owner_id,
    team_id: lead.current_owner?.team_id,
    escalation_reason: reason
  }]);

  console.log(`[Lino Suporte] 🚨 Lead ${leadId} escalado para supervisor: ${reason}`);
}

// Mantém a função antiga para compatibilidade (deprecated)
export async function handleClientReturnedToSDR(leadId: string): Promise<void> {
  const { data: lead } = await supabase
    .from('leads')
    .select('whatsapp_number')
    .eq('id', leadId)
    .single();

  if (lead) {
    await handleClientReturn(lead.whatsapp_number, '');
  }
}
