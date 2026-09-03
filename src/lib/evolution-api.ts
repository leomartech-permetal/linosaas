import { supabaseServer as supabase } from './supabase-server';
import { dispatch } from './dispatcher';

/**
 * Helper para interagir com a Evolution API.
 *
 * IMPORTANTE: Todas as funções de envio de mensagens neste módulo
 * passam obrigatoriamente pelo Dispatcher centralizado (dispatcher.ts).
 * Nenhum fetch() direto para a Evolution API é permitido aqui.
 */

/**
 * Envia uma mensagem de texto via Evolution API.
 * Internamente delega ao dispatcher centralizado.
 */
export async function sendTextMessage(
  _instanceName: string,
  _evolutionUrl: string,
  _evolutionKey: string,
  toNumber: string,
  text: string
): Promise<boolean> {
  const result = await dispatch({
    toPhone: toNumber,
    logicalRole: 'CUSTOMER',
    body: text,
    eventType: 'TEXT_MESSAGE',
  });
  return result.sent || result.blocked;
}

/**
 * Notifica o vendedor sobre um lead pendente.
 */
export async function notifySellerAboutLead(
  sellerPhone: string,
  leadName: string,
  _leadPhone: string,
  attempt: number,
  sellerName?: string,
  correlationLeadId?: string
): Promise<boolean> {
  const messages: Record<number, string> = {
    1: `🔔 *LINO — Novo Atendimento*\n\nOlá! O lead *${leadName}* foi qualificado e encaminhado para você.\n\nPor favor, inicie o atendimento o mais rápido possível.\n\nResponda: *Recebi* | *Vou atender* | *Transferir* | *Informar impedimento*`,
    2: `⚠️ *LINO — Cobrança de SLA*\n\nO cliente *${leadName}* ainda aguarda seu atendimento.\n\nJá se passaram mais de 30 minutos úteis. Por favor, inicie o contato.\n\nResponda: *Contato realizado* | *Vou atender* | *Informar impedimento*`,
    3: `🚨 *LINO — URGENTE*\n\nÚltimo aviso! O cliente *${leadName}* está *sem atendimento por mais de 1h30*.\n\nSe não houver resposta em breve, a coordenação será acionada.`,
  };

  const text = messages[attempt] || messages[1];
  const result = await dispatch({
    toPhone: sellerPhone,
    logicalRole: 'SELLER',
    logicalName: sellerName,
    body: text,
    eventType: 'SELLER_LEAD_NOTIFICATION',
    idempotencyKey: `seller-notif-lead-${correlationLeadId}-attempt-${attempt}`,
    correlationLeadId,
  });
  return result.sent || result.blocked;
}

/**
 * Notifica o vendedor sobre novas informações enviadas pelo cliente.
 */
export async function notifySellerAboutUpdate(
  sellerPhone: string,
  leadName: string,
  _leadPhone: string,
  updateMessage: string,
  sellerName?: string,
  correlationLeadId?: string
): Promise<boolean> {
  const text = `⚠️ *LINO — Atualização do Cliente*\n\nO cliente *${leadName}* enviou uma nova informação enquanto aguardava:\n\n_"${updateMessage}"_\n\nPor favor, leve isso em consideração ao atendê-lo.`;

  const result = await dispatch({
    toPhone: sellerPhone,
    logicalRole: 'SELLER',
    logicalName: sellerName,
    body: text,
    eventType: 'SELLER_UPDATE_NOTIFICATION',
    idempotencyKey: `seller-update-${correlationLeadId}-${Date.now()}`,
    correlationLeadId,
  });
  return result.sent || result.blocked;
}

/**
 * Notifica o supervisor que o vendedor não atendeu dentro do prazo.
 */
export async function notifySupervisor(
  supervisorPhone: string,
  sellerName: string,
  leadName: string,
  _leadPhone: string,
  correlationLeadId?: string
): Promise<boolean> {
  const text =
    `🚨 *LINO — Escalação para Coordenação*\n\n` +
    `O vendedor *${sellerName}* não iniciou o atendimento do cliente *${leadName}* dentro do prazo de SLA.\n\n` +
    `Por favor, verifique e tome as providências necessárias.`;

  const result = await dispatch({
    toPhone: supervisorPhone,
    logicalRole: 'SUPERVISOR',
    body: text,
    eventType: 'SUPERVISOR_ESCALATION',
    idempotencyKey: `supervisor-escalation-${correlationLeadId}-${Date.now()}`,
    correlationLeadId,
  });
  return result.sent || result.blocked;
}
