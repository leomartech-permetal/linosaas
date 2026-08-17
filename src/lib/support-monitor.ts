import { supabase } from './supabase';
import { generateSupportResponse } from './openai';
import {
  notifySellerAboutLead,
  notifySupervisor,
  notifySellerAboutUpdate
} from './evolution-api';

/**
 * LINO SUPORTE E PÓS-VENDA (Modelo Passivo)
 * 
 * Regras do modelo receptivo:
 * - O Lino NÃO monitora o celular do vendedor.
 * - O SLA é acionado APENAS se o cliente voltar a mandar mensagem no número central do Lino.
 * - O Lino atua como concierge/ouvidoria: notifica o vendedor, acalma o cliente e registra as métricas.
 */

/**
 * Busca o telefone ativo do vendedor (fallback para whatsapp_number em admin_users).
 */
async function getSellerPhone(sellerId: string): Promise<string> {
  try {
    const { data: seller } = await supabase
      .from('admin_users')
      .select('whatsapp_number')
      .eq('id', sellerId)
      .single();

    return seller?.whatsapp_number || '';
  } catch (e) {
    console.error('[Lino Suporte] Erro ao buscar telefone do vendedor:', e);
    return '';
  }
}

/**
 * Busca o supervisor de uma equipe.
 */
async function getTeamSupervisor(teamId: string | null): Promise<{ name: string; phone: string } | null> {
  if (!teamId) return null;

  try {
    const { data: team } = await supabase
      .from('teams')
      .select('manager_id, supervisor_name, supervisor_phone')
      .eq('id', teamId)
      .single();

    if (!team) return null;

    if (team.supervisor_phone) {
      return {
        name: team.supervisor_name || 'Supervisor',
        phone: team.supervisor_phone
      };
    }

    if (team.manager_id) {
      const { data: manager } = await supabase
        .from('admin_users')
        .select('name, whatsapp_number')
        .eq('id', team.manager_id)
        .single();

      if (manager?.whatsapp_number) {
        return {
          name: manager.name || 'Supervisor',
          phone: manager.whatsapp_number
        };
      }
    }
  } catch (e) {
    console.error('[Lino Suporte] Erro ao buscar supervisor:', e);
  }

  return null;
}

/**
 * ENTRY POINT PASSIVO: HandleClientReturn
 * Quando o lead volta a falar na central Lino, decidimos a ação baseada no status atual.
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

  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*, current_owner_id')
    .eq('whatsapp_number', whatsappNumber)
    .single();

  if (leadError || !lead) {
    console.log('[Lino Suporte] Lead não encontrado ou erro:', leadError?.message);
    return { 
      action: 'NEW_LEAD', 
      message: 'Olá! Vou te ajudar. Para começar, me conta o que você precisa?' 
    };
  }

  let currentOwner = null;
  if (lead.current_owner_id) {
    const { data: owner } = await supabase
      .from('admin_users')
      .select('name, whatsapp_number, team_id')
      .eq('id', lead.current_owner_id)
      .single();
    currentOwner = owner;
  }
  lead.current_owner = currentOwner;

  // Se o lead já comprou, é LINO PÓS-VENDA
  if (lead.status === 'WON' || lead.status === 'POST_SALE') {
    return handlePostSaleReturn(lead, message);
  }

  // LINO SUPORTE ATENDIMENTO (Fase de cotação/orçamento)
  const sentTime = lead.sent_to_seller_at || lead.updated_at;
  const hoursSinceSent = (Date.now() - new Date(sentTime).getTime()) / 3600000;

  const { data: returnAttempts } = await supabase
    .from('lead_follow_ups')
    .select('*')
    .eq('lead_id', lead.id)
    .eq('status', 'CLIENT_RETURNED')
    .order('created_at', { ascending: false });

  const returnCount = returnAttempts?.length || 0;
  const lastReturn = returnAttempts?.[0];
  
  const twentyMinutesAgo = Date.now() - 20 * 60000;
  const isRecentReturn = lastReturn?.last_client_message_at && 
    new Date(lastReturn.last_client_message_at).getTime() > twentyMinutesAgo;

  // No modelo passivo, consideramos que o vendedor respondeu se o status for IN_NEGOTIATION ou além.
  const sellerResponded = lead.status !== 'WAITING_SELLER' && lead.status !== 'SENT_TO_SELLER';

  // Registra gargalo se vendedor não atendeu e já passou muito tempo
  await registerBottleneckIfNeeded(lead, sellerResponded, hoursSinceSent, returnCount);

  const action = await decideActionByStatus(lead, sellerResponded, hoursSinceSent, returnCount, isRecentReturn);

  if (!isRecentReturn) {
    await registerClientReturn(lead.id, lead.current_owner_id, returnCount + 1, hoursSinceSent);
  }

  console.log(`[Lino Suporte] 📊 Ação decided: ${action.action}, Retornos: ${returnCount}`);

  return {
    ...action,
    leadData: lead
  };
}

async function handlePostSaleReturn(lead: any, message: string): Promise<{ action: string; message: string }> {
  // O Lino atua como Ouvidoria receptiva.
  const { data: interactionData } = await supabase
    .from('interactions')
    .select('message_content')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const aiResponse = await generateSupportResponse(
    lead, 
    (interactionData || []).reverse(), 
    'POS_VENDA_RECEPTIVO'
  );

  // Armazena o número do pedido se extraído
  if (aiResponse.numero_pedido && aiResponse.numero_pedido !== 'null') {
    const qState = lead.qualification_state || { valores: {} };
    if (!qState.valores) qState.valores = {};
    qState.valores.numero_pedido = aiResponse.numero_pedido;
    await supabase.from('leads').update({ qualification_state: qState }).eq('id', lead.id);
  }

  // Escalação urgente (atraso, chargeback, devolução)
  if (aiResponse.escalar_urgente) {
    console.log(`[Lino Pós-Venda] 🚨 Escalação urgente detectada para o lead ${lead.id} - Intenção: ${aiResponse.intencao_pos_venda}`);
    
    // Escala para o supervisor imediatamente
    await escalateToSupervisor(
      lead.id, 
      `🚨 URGÊNCIA PÓS-VENDA (${aiResponse.intencao_pos_venda?.toUpperCase() || 'PROBLEMA'}): O cliente relatou um problema grave. Pedido associado: ${aiResponse.numero_pedido || 'Não informado'}.`
    );

    // Notificar também o vendedor para ciência
    const sellerPhone = await getSellerPhone(lead.current_owner_id);
    if (sellerPhone) {
      await notifySellerAboutUpdate(
        sellerPhone, 
        lead.name || 'Cliente', 
        lead.whatsapp_number, 
        `⚠️ ALERTA DE ${aiResponse.intencao_pos_venda?.toUpperCase() || 'PROBLEMA'}! O cliente acionou a ouvidoria. A coordenação já foi notificada.`
      );
    }

    return {
      action: 'ESCALATE_SUPERVISOR_POST_SALE',
      message: aiResponse.message
    };
  }
  
  return {
    action: 'POST_SALE_SUPPORT',
    message: aiResponse.message || 'Sou o Lino Pós-Venda. Se você precisa de assistência com a entrega ou produto, me informe o número do pedido ou da nota fiscal.'
  };
}

/**
 * Decide a ação baseada no status e dispara notificações
 */
async function decideActionByStatus(
  lead: any,
  sellerResponded: boolean,
  hoursSinceSent: number,
  returnCount: number,
  isRecentReturn: boolean
): Promise<{ action: string; message: string }> {
  const status = lead.status;

  if (status === 'SDR_QUALIFICATION' || status === 'QUALIFIED') {
    return {
      action: 'CONTINUE_QUALIFICATION',
      message: 'Deixe-me continuar com as informações que precisamos.'
    };
  }

  if (status === 'WAITING_SELLER' || status === 'SENT_TO_SELLER') {
    if (!sellerResponded) {
      const { data: globalConfig } = await supabase.from('tenant_config').select('sla_rules').single();
      const maxWaitHours = globalConfig?.sla_rules?.max_wait_hours || 2;

      // Escalar se estourou muito o SLA ou reclamou muitas vezes
      if (hoursSinceSent >= maxWaitHours || returnCount >= 3) {
        await notifySupervisorUrgent(lead);
        return {
          action: 'ESCALATE_SUPERVISOR',
          message: 'Entendo sua urgência. Já acionei a coordenação para verificar seu atendimento imediatamente.'
        };
      }

      // IA responde o cliente
      const { data: interactionData } = await supabase.from('interactions').select('sender_type, message_content').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(10);
      const aiResponse = await generateSupportResponse(lead, (interactionData || []).reverse(), returnCount >= 1 ? 'COBRANÇA_URGENTE' : 'PRIMEIRO_RETORNO');
      
      const lastClientMessage = (interactionData || []).find(i => i.sender_type === 'USER')?.message_content || 'Nova informação';

      if (aiResponse.nova_informacao) {
        const sellerPhone = await getSellerPhone(lead.current_owner_id);
        if (sellerPhone) {
          await notifySellerAboutUpdate(sellerPhone, lead.name || 'Lead', lead.whatsapp_number || '', lastClientMessage);
        }
        return {
          action: 'NOTIFY_SELLER_UPDATE',
          message: aiResponse.message
        };
      }

      if (returnCount >= 1) {
        await notifySellerUrgent(lead, returnCount);
        return {
          action: 'NOTIFY_SELLER_URGENT',
          message: aiResponse.message
        };
      }

      const sellerPhone = await getSellerPhone(lead.current_owner_id);
      if (sellerPhone) {
        await notifySellerAboutLead(sellerPhone, lead.name || 'Lead', lead.whatsapp_number || '', 3);
      }
      return {
        action: 'NOTIFY_SELLER',
        message: aiResponse.message
      };
    }
  }

  if (status === 'IN_NEGOTIATION' || status === 'ATTENDANCE_STARTED') {
    return {
      action: 'FORWARD_TO_SELLER',
      message: 'Seu atendimento já foi iniciado. Vou reforçar com o especialista que você mandou mensagem.'
    };
  }

  return {
    action: 'GENERIC_RESPONSE',
    message: 'Vou verificar sua situação e registrar a ocorrência.'
  };
}

async function notifySellerUrgent(lead: any, returnCount: number): Promise<void> {
  if (!lead.current_owner_id) return;

  const sellerPhone = await getSellerPhone(lead.current_owner_id);
  if (sellerPhone) {
    await notifySellerAboutLead(
      sellerPhone,
      lead.name || 'Lead',
      lead.whatsapp_number || '',
      3
    );
  }
}

async function notifySupervisorUrgent(lead: any): Promise<void> {
  const supervisor = await getTeamSupervisor(lead.current_owner?.team_id);
  if (!supervisor?.phone) return;

  await notifySupervisor(
    supervisor.phone,
    lead.current_owner?.name || 'Vendedor',
    lead.name || 'Lead',
    lead.whatsapp_number || ''
  );

  await supabase.from('supervisor_escalations').insert([{
    lead_id: lead.id,
    user_id: lead.current_owner_id,
    team_id: lead.current_owner?.team_id,
    escalation_reason: 'Cliente voltou reclamando de falta de atendimento/prazo.'
  }]);

  await updateLeadStatus(lead.id, 'ESCALATED_TO_SUPERVISOR');
}

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
    ? `Cliente cobrou atendimento na central ${returnCount}x (${hoursSinceSent.toFixed(1)}h desde roteamento)`
    : `SLA estourado (notificado proativamente pela central): ${hoursSinceSent.toFixed(1)}h`;

  await supabase.from('attendance_bottlenecks').insert([{
    lead_id: lead.id,
    bottleneck_type: type,
    severity: severity,
    description: description,
    hours_waited: hoursSinceSent
  }]);

  return true;
}

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
    reason: `Mudança automática via Lino Suporte Passivo`
  }]);
}

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

  const updateData: any = { 
    status: newStatus,
    updated_at: new Date().toISOString()
  };

  if (newStatus === 'SENT_TO_SELLER') {
    updateData.sent_to_seller_at = new Date().toISOString();
  } else if (newStatus === 'SELLER_RECEIVED') {
    updateData.seller_confirmed_at = new Date().toISOString();
  } else if (newStatus === 'ATTENDANCE_STARTED') {
    updateData.attendance_started_at = new Date().toISOString();
  }

  await supabase.from('leads').update(updateData).eq('id', leadId);
  await registerStatusHistory(leadId, lead.status, newStatus, 'system');
}

export async function escalateToSupervisor(
  leadId: string,
  reason: string
): Promise<void> {
  const { data: lead } = await supabase
    .from('leads')
    .select('*, current_owner:admin_users(name, team_id)')
    .eq('id', leadId)
    .single();

  if (!lead) return;

  await updateLeadStatus(leadId, 'ESCALATED_TO_SUPERVISOR');

  const supervisor = await getTeamSupervisor(lead.current_owner?.team_id);
  if (supervisor?.phone) {
    await notifySupervisor(
      supervisor.phone,
      lead.current_owner?.name || 'Vendedor',
      lead.name || 'Lead',
      lead.whatsapp_number || ''
    );
  }

  await supabase.from('supervisor_escalations').insert([{
    lead_id: leadId,
    user_id: lead.current_owner_id,
    team_id: lead.current_owner?.team_id,
    escalation_reason: reason
  }]);
}

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
