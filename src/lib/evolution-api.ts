import { supabase } from './supabase';
import { isPhoneAuthorized } from './test-guard';

/**
 * Helper para interagir com a Evolution API.
 * Envia mensagens WhatsApp e verifica conversas ativas.
 */

interface EvolutionConfig {
  url: string;
  key: string;
  instanceName: string;
}

/**
 * Busca as credenciais globais da Evolution API no tenant_config.
 */
async function getGlobalConfig(): Promise<EvolutionConfig | null> {
  const { data } = await supabase
    .from('tenant_config')
    .select('evolution_url, evolution_key, evolution_instance_name')
    .limit(1)
    .single();

  if (!data?.evolution_url || !data?.evolution_key) {
    console.warn('[Evolution] Credenciais globais não configuradas.');
    return null;
  }

  return {
    url: data.evolution_url.replace(/\/+$/, ''),
    key: data.evolution_key,
    instanceName: data.evolution_instance_name || '',
  };
}

/**
 * Busca a config da instância específica de um vendedor.
 * Se a instância tiver URL/Key própria, usa. Senão, usa a global.
 */
async function getInstanceConfigForUser(userId: string): Promise<{ config: EvolutionConfig; instanceName: string; phoneNumber: string } | null> {
  const { data: instance } = await supabase
    .from('instances')
    .select('*')
    .eq('assigned_user_id', userId)
    .eq('active', true)
    .limit(1)
    .single();

  if (!instance) {
    console.warn(`[Evolution] Nenhuma instância ativa para o vendedor ${userId}`);
    return null;
  }

  const globalConfig = await getGlobalConfig();

  const config: EvolutionConfig = {
    url: (instance.evolution_url || globalConfig?.url || '').replace(/\/+$/, ''),
    key: instance.evolution_key || globalConfig?.key || '',
    instanceName: instance.evolution_instance_name || globalConfig?.instanceName || '',
  };

  if (!config.url || !config.key) {
    console.warn('[Evolution] Sem URL ou Key configurada para enviar mensagem.');
    return null;
  }

  return {
    config,
    instanceName: config.instanceName,
    phoneNumber: instance.phone_number || '',
  };
}

/**
 * Envia uma mensagem de texto via Evolution API.
 */
export async function sendTextMessage(
  instanceName: string,
  evolutionUrl: string,
  evolutionKey: string,
  toNumber: string,
  text: string
): Promise<boolean> {
  // ── GUARD DE MODO DE TESTE ──────────────────────────────────────────────
  // Nunca envia para número não autorizado, independentemente de como chegou.
  if (!isPhoneAuthorized(toNumber)) {
    console.log(`[Evolution Guard] Envio bloqueado em modo de teste para: ${toNumber}`);
    return false;
  }
  // ────────────────────────────────────────────────────────────────────────

  try {
    // Garante formato correto do número
    const jid = toNumber.includes('@') ? toNumber : `${toNumber.replace(/\D/g, '')}@s.whatsapp.net`;

    const response = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionKey,
      },
      body: JSON.stringify({
        number: jid.replace('@s.whatsapp.net', ''),
        text,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[Evolution] Erro ao enviar mensagem: ${response.status} - ${errorBody}`);
      return false;
    }

    console.log(`[Evolution] Mensagem enviada para ${toNumber} via ${instanceName}`);
    return true;
  } catch (error) {
    console.error('[Evolution] Falha ao enviar mensagem:', error);
    return false;
  }
}

/**
 * Notifica o vendedor sobre um lead pendente.
 * Usa a instância global (SDR/Suporte) para enviar a mensagem ao número do vendedor.
 */
export async function notifySellerAboutLead(
  sellerPhone: string,
  leadName: string,
  leadPhone: string,
  attempt: number
): Promise<boolean> {
  const globalConfig = await getGlobalConfig();
  if (!globalConfig) return false;

  const messages: Record<number, string> = {
    1: `🔔 *LINO SUPORTE — Novo Lead*\n\nOlá! O lead *${leadName}* (${leadPhone}) foi classificado e encaminhado para você.\n\nPor favor, inicie o atendimento o mais rápido possível.`,
    2: `⚠️ *LINO SUPORTE — Cobrança*\n\nO lead *${leadName}* (${leadPhone}) ainda aguarda seu atendimento.\n\nJá se passaram mais de 40 minutos. Por favor, inicie o contato.`,
    3: `🚨 *LINO SUPORTE — URGENTE*\n\nÚltimo aviso! O lead *${leadName}* (${leadPhone}) está *sem atendimento há mais de 1h20*.\n\nSe não houver resposta em breve, o supervisor será notificado.`,
  };

  const text = messages[attempt] || messages[1];
  return sendTextMessage(globalConfig.instanceName, globalConfig.url, globalConfig.key, sellerPhone, text);
}

/**
 * Notifica o vendedor sobre novas informações que o cliente enviou pós-roteamento.
 */
export async function notifySellerAboutUpdate(
  sellerPhone: string,
  leadName: string,
  leadPhone: string,
  updateMessage: string
): Promise<boolean> {
  const globalConfig = await getGlobalConfig();
  if (!globalConfig) return false;

  const text = `⚠️ *LINO SUPORTE — ATUALIZAÇÃO DO CLIENTE*\n\nO cliente *${leadName}* (${leadPhone}) enviou uma nova informação de especificação enquanto aguardava seu atendimento:\n\n_"${updateMessage}"_\n\nPor favor, leve isso em consideração ao atendê-lo.`;

  return sendTextMessage(globalConfig.instanceName, globalConfig.url, globalConfig.key, sellerPhone, text);
}

/**
 * Notifica o supervisor que o vendedor não atendeu o lead dentro do prazo.
 */
export async function notifySupervisor(
  supervisorPhone: string,
  sellerName: string,
  leadName: string,
  leadPhone: string
): Promise<boolean> {
  const globalConfig = await getGlobalConfig();
  if (!globalConfig) return false;

  const text = `🚨 *LINO SUPORTE — ESCALAÇÃO PARA SUPERVISOR*\n\n` +
    `O vendedor *${sellerName}* não iniciou o atendimento do lead *${leadName}* (${leadPhone}) dentro do prazo de 2 horas.\n\n` +
    `Por favor, verifique e tome as providências necessárias.`;

  return sendTextMessage(globalConfig.instanceName, globalConfig.url, globalConfig.key, supervisorPhone, text);
}

