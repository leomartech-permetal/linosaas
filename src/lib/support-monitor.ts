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
 * Chamada quando um cliente retorna ao SDR sem ter sido atendido.
 * Dispara notificação urgente ao vendedor.
 */
export async function handleClientReturnedToSDR(leadId: string): Promise<void> {
  console.log(`[Lino Suporte] 🔄 Cliente do lead ${leadId} voltou a falar com SDR — vendedor não atendeu!`);

  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (!lead || !lead.current_owner_id) return;

  // Buscar telefone do vendedor
  const { data: sellerInstance } = await supabase
    .from('instances')
    .select('phone_number')
    .eq('assigned_user_id', lead.current_owner_id)
    .eq('active', true)
    .limit(1)
    .single();

  if (!sellerInstance?.phone_number) return;

  const { data: seller } = await supabase
    .from('admin_users')
    .select('name')
    .eq('id', lead.current_owner_id)
    .single();

  // Enviar notificação urgente
  await notifySellerAboutLead(
    sellerInstance.phone_number,
    lead.name || 'Lead',
    lead.whatsapp_number || '',
    3 // Usa a mensagem urgente
  );

  // Registrar no follow-up
  await supabase.from('lead_follow_ups').insert([{
    lead_id: leadId,
    assigned_user_id: lead.current_owner_id,
    attempt_number: 0, // Especial: retorno do cliente
    status: 'CLIENT_RETURNED',
  }]);

  console.log(`[Lino Suporte] ⚡ Notificação urgente enviada para ${seller?.name || 'vendedor'}`);
}
