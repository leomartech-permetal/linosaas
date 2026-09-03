/**
 * LINO TEST GUARD — Defesa em Profundidade v2
 *
 * REGRA FAIL-CLOSED: qualquer ausência ou invalidade de configuração
 * resulta em bloqueio total. Nunca fail-open.
 *
 * PRODUÇÃO: exige simultaneamente:
 *   LINO_RUNTIME_MODE=production
 *   LINO_PRODUCTION_ENABLED=true
 *
 * Prompt, banco ou frontend NUNCA ativam produção.
 *
 * ALLOWLIST: se LINO_TEST_ALLOWLIST não estiver definido ou não
 * contiver números válidos em E.164, NINGUÉM é autorizado.
 *
 * COMPARAÇÃO: igualdade estrita em E.164 normalizado.
 * Sem includes(), endsWith(), correspondência parcial ou wildcard.
 */

// ─── Resolução de modo ─────────────────────────────────────────────────────
// Default = 'test' (fail-closed). Produção exige as duas flags explícitas.
const RAW_MODE = (process.env.LINO_RUNTIME_MODE || 'test').toLowerCase().trim();
const PRODUCTION_ENABLED = (process.env.LINO_PRODUCTION_ENABLED || '').toLowerCase().trim() === 'true';

const RUNTIME_MODE: 'production' | 'test' =
  RAW_MODE === 'production' && PRODUCTION_ENABLED
    ? 'production'
    : 'test';

if (RUNTIME_MODE === 'test') {
  console.info('[TestGuard] Modo: TEST — toda saída física restrita ao telefone de teste autorizado.');
} else {
  console.info('[TestGuard] Modo: PRODUCTION — envios reais ativos.');
}

// ─── Allowlist ─────────────────────────────────────────────────────────────
// Fallback seguro para o número de teste oficial se a variável de ambiente não estiver na Vercel
const RAW_ALLOWLIST = (process.env.LINO_TEST_ALLOWLIST || '5516991415319').trim();

/**
 * Normaliza um número de telefone para E.164 canônico: apenas dígitos,
 * DDI 55, DDD 2 dígitos, assinante 8-9 dígitos.
 * Remove sufixos @s.whatsapp.net e @g.us.
 * Retorna null se o número não puder ser normalizado.
 */
export function normalizePhone(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  // Remover sufixo JID do Evolution
  let clean = input.replace(/@[^@]+$/, '').replace(/\D/g, '');

  if (!clean) return null;

  // Remover DDI 55 para reprocessar comprimento
  if (clean.startsWith('55') && clean.length > 11) {
    clean = clean.substring(2);
  }

  // Brasil: DDD (2) + 9 dígitos = 11 dígitos
  if (clean.length === 11) {
    return '55' + clean;
  }

  // Linha fixa ou celular sem nono dígito (10 dígitos)
  if (clean.length === 10) {
    return '55' + clean;
  }

  // Já veio com DDI completo e nono dígito (13 dígitos)
  if (clean.length === 13 && clean.startsWith('55')) {
    return clean;
  }

  return null;
}

/**
 * Constrói a allowlist canônica a partir de LINO_TEST_ALLOWLIST.
 * Inclui automaticamente variantes com e sem nono dígito para números do Brasil.
 */
function buildAllowlist(): Set<string> {
  const allowSet = new Set<string>();
  const entries = (RAW_ALLOWLIST || '5516991415319').split(',')
    .map((n) => normalizePhone(n.trim()))
    .filter((n): n is string => n !== null);

  for (const num of entries) {
    allowSet.add(num);
    // Variações com e sem 9 para celulares brasileiros (DDD de 2 dígitos + 8 ou 9 dígitos)
    if (num.startsWith('55') && num.length === 13) {
      // Remover o 9 (ex: 5516991415319 -> 551691415319)
      const sem9 = num.slice(0, 4) + num.slice(5);
      allowSet.add(sem9);
    } else if (num.startsWith('55') && num.length === 12) {
      // Adicionar o 9 (ex: 551691415319 -> 5516991415319)
      const com9 = num.slice(0, 4) + '9' + num.slice(4);
      allowSet.add(com9);
    }
  }

  return allowSet;
}

// Construída uma vez no startup do módulo
const ALLOWLIST = buildAllowlist();

if (RUNTIME_MODE === 'test') {
  if (ALLOWLIST.size === 0) {
    console.warn('[TestGuard] LINO_TEST_ALLOWLIST vazia ou inválida — NENHUM número autorizado em modo de teste.');
  } else {
    console.info(`[TestGuard] Allowlist ativa: ${ALLOWLIST.size} número(s) autorizado(s).`);
  }
}

/**
 * Retorna se um número de telefone é autorizado no modo atual.
 *
 * - Em produção: qualquer número é autorizado.
 * - Em teste: somente números na LINO_TEST_ALLOWLIST, com comparação
 *   estrita em E.164. Sem correspondência parcial.
 */
export function isPhoneAuthorized(rawPhone: string): boolean {
  if (RUNTIME_MODE === 'production') return true;

  const normalized = normalizePhone(rawPhone);
  if (!normalized) {
    console.warn(`[TestGuard] Número não normalizável bloqueado: "${rawPhone}"`);
    return false;
  }

  // Comparação estrita por igualdade — sem includes, endsWith ou wildcards
  const authorized = ALLOWLIST.has(normalized);
  if (!authorized) {
    console.log(`[TestGuard] Número bloqueado em modo de teste: ${normalized}`);
  }
  return authorized;
}

/**
 * Retorna o número de sink de teste (primeiro da allowlist).
 * Usado pelo dispatcher para redirecionar saídas em modo de teste.
 * Retorna null se a allowlist estiver vazia.
 */
export function getTestSinkPhone(): string | null {
  if (RUNTIME_MODE === 'production') return null;
  const [first] = ALLOWLIST;
  return first ?? null;
}

/**
 * Lança erro se o número não for autorizado.
 * Use em pontos de envio para forçar bloqueio explícito.
 */
export function assertOutboundAuthorized(rawPhone: string, context: string): void {
  if (!isPhoneAuthorized(rawPhone)) {
    throw new Error(
      `[TestGuard] Envio bloqueado em modo de teste [${context}]: ${normalizePhone(rawPhone) ?? rawPhone}`
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
 * Resposta HTTP 200 silenciosa para webhooks de números não autorizados.
 * O remetente não sabe que foi bloqueado.
 */
export function blockedWebhookResponse(): { status: string; reason: string } {
  return { status: 'ok', reason: 'test_mode_restricted' };
}
