/**
 * LINO TEST GUARD — Defesa em Profundidade
 *
 * Protege TODOS os pontos de saída automática (webhook de entrada,
 * envio de WhatsApp, follow-ups, notificações a vendedores e supervisores)
 * enquanto LINO_RUNTIME_MODE=test.
 *
 * REGRA FAIL-CLOSED: se LINO_TEST_ALLOWLIST não estiver configurado,
 * o sistema trata o ambiente como "teste fechado" e bloqueia tudo.
 *
 * AUTORIDADE DE CONFIGURAÇÃO: variáveis de ambiente apenas.
 * Produção NÃO pode ser ativada por prompt.
 */

const RUNTIME_MODE = (process.env.LINO_RUNTIME_MODE || 'test').toLowerCase();
const RAW_ALLOWLIST = process.env.LINO_TEST_ALLOWLIST || '';

/**
 * Normaliza um número de telefone para formato canônico: apenas dígitos,
 * com DDI 55, DDD de 2 dígitos e 9 dígitos de assinante.
 * Remove sufixos @s.whatsapp.net e @g.us.
 */
export function normalizePhone(input: string): string | null {
  if (!input) return null;

  // Remover sufixo JID do Evolution
  let clean = input.replace(/@[^@]+$/, '').replace(/\D/g, '');

  if (!clean) return null;

  // Remover DDI 55 para reprocessar
  if (clean.startsWith('55') && clean.length > 11) {
    clean = clean.substring(2);
  }

  // Brasil: DDD (2) + 9 dígitos = 11 dígitos
  // Aceitar também 10 dígitos (linha fixa / sem nono dígito em DDDs antigos)
  if (clean.length === 11) {
    return '55' + clean;
  }

  // Linha fixa ou celular sem nono dígito (10 dígitos): aceitar
  if (clean.length === 10) {
    return '55' + clean;
  }

  // Já veio com DDI completo (13 dígitos com nono: 55 + DDD + 9 dígitos)
  if (clean.length === 13) {
    return clean;
  }

  // Número inválido / não resolvível
  return null;
}

/**
 * Obtém a allowlist canônica a partir de LINO_TEST_ALLOWLIST.
 * Suporta múltiplos números separados por vírgula.
 */
function getAllowlist(): Set<string> {
  if (!RAW_ALLOWLIST.trim()) return new Set();
  return new Set(
    RAW_ALLOWLIST.split(',')
      .map((n) => normalizePhone(n.trim()))
      .filter((n): n is string => n !== null)
  );
}

/**
 * Retorna se o número é autorizado no modo atual.
 *
 * - Em modo 'production': qualquer número é autorizado.
 * - Em modo 'test': apenas os números na LINO_TEST_ALLOWLIST.
 * - Se allowlist estiver vazia (variável ausente): BLOQUEIA TUDO (fail-closed).
 */
export function isPhoneAuthorized(rawPhone: string): boolean {
  if (RUNTIME_MODE === 'production') return true;

  const normalized = normalizePhone(rawPhone);
  if (!normalized) {
    console.warn(`[TestGuard] Número não resolvível bloqueado: "${rawPhone}"`);
    return false;
  }

  const allowlist = getAllowlist();

  // Fail-closed: se allowlist vazia, sistema permanece fechado
  if (allowlist.size === 0) {
    console.warn('[TestGuard] LINO_TEST_ALLOWLIST não configurado — sistema fechado.');
    return false;
  }

  const authorized = allowlist.has(normalized);
  if (!authorized) {
    console.log(`[TestGuard] Número bloqueado em modo de teste: ${normalized}`);
  }
  return authorized;
}

/**
 * Lança erro se o número não for autorizado.
 * Use em pontos de envio para forçar bloqueio explícito.
 */
export function assertOutboundAuthorized(rawPhone: string, context: string): void {
  if (!isPhoneAuthorized(rawPhone)) {
    throw new Error(
      `[TestGuard] Envio bloqueado em modo de teste [${context}]: ${rawPhone}`
    );
  }
}

/**
 * Retorna se o sistema está em modo de teste.
 */
export function isTestMode(): boolean {
  return RUNTIME_MODE !== 'production';
}

/**
 * Cria resposta de webhook bloqueado — HTTP 200 silencioso.
 * O remetente não sabe que foi bloqueado.
 */
export function blockedWebhookResponse(): { status: string; reason: string } {
  return { status: 'ok', reason: 'test_mode_restricted' };
}
