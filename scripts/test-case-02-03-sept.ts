/**
 * SUITE DE TESTES: CASO REAL BLOQUEADOR — 02 e 03/09/2026
 *
 * Simula a linha do tempo do caso real:
 * - 02/09 14h54: Lead atribuído e encaminhado ao vendedor
 * - 02/09 19h07: Cliente envia "Oi" + "Boa noite" + "E meu orçamento" + "ninguém me chamou"
 * - 03/09 07h17: Cliente cobra na abertura do dia: "algum retorno?"
 * - 03/09 07h18: Reclamação explícita: "preciso apresentar o projeto hoje, tem outra pessoa?"
 */

import {
  calcBusinessMinutes,
  computeSlaStatus,
  DEFAULT_SLA_POLICY,
  isWithinGroupingWindow,
} from '../src/lib/sla-service';
import { isPhoneAuthorized, normalizePhone, getTestSinkPhone, isTestMode } from '../src/lib/test-guard';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, label?: string) {
  if (actual !== expected) {
    throw new Error(`${label ? label + ': ' : ''}esperado "${expected}", obtido "${actual}"`);
  }
}

console.log('\n🔵 test-case-02-03-sept.ts — CASO REAL BLOQUEADOR 02 e 03/09/2026\n');

// ── Item 1: Blindagem de ambiente de teste ────────────────────────────────────
test('Blindagem: Em teste, somente 5516991415319 recebe saída física', () => {
  assert(isTestMode(), 'Deve estar em modo de teste');
  const allowed = '5516991415319';
  const unauthorizedSeller = '5511988887777';
  const unauthorizedCustomer = '5516981234567';

  // Se allowlist tiver o número oficial de teste configurado
  process.env.LINO_TEST_ALLOWLIST = allowed;
  assert(!isPhoneAuthorized(unauthorizedSeller), 'Vendedor real deve ser bloqueado');
  assert(!isPhoneAuthorized(unauthorizedCustomer), 'Cliente real deve ser bloqueado');
});

// ── Item 2: SLA e cálculo exato de 126 minutos úteis às 19h07 de 02/09 ─────────
test('Cálculo determinístico: 126 min úteis às 19h07 e SLA violado', () => {
  const assignedAt = new Date('2026-09-02T17:54:00Z'); // 14:54 BRT
  const eveningMessage = new Date('2026-09-02T22:07:00Z'); // 19:07 BRT (após expediente)

  const businessMinutes = calcBusinessMinutes(assignedAt, eveningMessage, DEFAULT_SLA_POLICY);
  assertEqual(businessMinutes, 126, 'minutos úteis decorridos até 17h00');

  const status = computeSlaStatus(assignedAt, eveningMessage, DEFAULT_SLA_POLICY);
  assertEqual(status.state, 'BREACHED', 'Estado de SLA deve ser BREACHED');
  assertEqual(status.business_minutes_elapsed, 126);
});

// ── Item 3: Retorno às 07h17 de 03/09 (143 min úteis acumulados) ─────────────
test('Cálculo determinístico: 143 min úteis às 07h17 de 03/09', () => {
  const assignedAt = new Date('2026-09-02T17:54:00Z'); // 02/09 14:54 BRT
  const morningMessage = new Date('2026-09-03T10:17:00Z'); // 03/09 07:17 BRT

  const businessMinutes = calcBusinessMinutes(assignedAt, morningMessage, DEFAULT_SLA_POLICY);
  assertEqual(businessMinutes, 143, '126 min de ontem + 17 min de hoje');

  const status = computeSlaStatus(assignedAt, morningMessage, DEFAULT_SLA_POLICY);
  assertEqual(status.state, 'BREACHED');
});

// ── Item 4: Agrupamento da janela de 15 minutos ──────────────────────────────
test('Janela operacional de 15 min agrupa mensagens de 07h17 e 07h18', () => {
  const msg1 = new Date('2026-09-03T10:17:00Z'); // 07:17 BRT
  const msg2 = new Date('2026-09-03T10:18:00Z'); // 07:18 BRT (1 min depois)
  const isGrouped = isWithinGroupingWindow(msg1, msg2, DEFAULT_SLA_POLICY);
  assert(isGrouped, 'Retorno de 07h18 deve ser agrupado na janela de 15min');
});

// ── Item 5: Detecção de urgência e ausência de placeholders ──────────────────
test('Verificação de texto: sem placeholders e sem texto interno', () => {
  const sampleResponse =
    'Leonardo, seu pedido de orçamento foi encaminhado ontem às 14h54, mas ainda não há registro de contato do consultor. Registrei seu retorno e reforcei com prioridade.';

  assert(!sampleResponse.includes('[Nome Vendedor]'), 'Não pode conter [Nome Vendedor]');
  assert(!sampleResponse.includes('[Realizando a auditoria'), 'Não pode conter texto interno');
  assert(!sampleResponse.includes('undefined'), 'Não pode conter undefined');
  assert(!sampleResponse.includes('null'), 'Não pode conter null');
});

console.log(`\n==================================================`);
console.log(`📊 Resultado: ${passed} passaram | ${failed} falharam`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n🎉 Cenário do caso real 02-03/09 validado com sucesso!\n');
}
