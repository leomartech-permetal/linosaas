/**
 * TESTES: SLA CALENDAR & HORAS ÚTEIS DETERMINÍSTICAS
 *
 * Valida o calendário comercial útil:
 * - Horário Permetal: Seg-Qui (07-12 e 13-17) = 9h/dia = 540 min/dia
 *                     Sex     (07-12 e 13-16) = 8h/dia = 480 min/dia
 * - Almoço: 12:00 às 13:00 (não conta como tempo útil)
 * - Fim de semana: sábado e domingo = 0 min
 * - Caso Real 02/09/2026:
 *     Quarta-feira (02/09), encaminhado às 14h54.
 *     Até o fim do expediente (17h00) decorrem exatamente 126 minutos úteis (2h06).
 *     Às 19h07 (fora de expediente): continuam sendo 126 minutos úteis e SLA violado (limite = 30 min).
 *     Às 07h17 do dia seguinte (03/09): 17 minutos úteis após abertura (total: 143 min úteis).
 */

import {
  calcBusinessMinutes,
  addBusinessMinutes,
  computeSlaStatus,
  DEFAULT_SLA_POLICY,
  isWithinGroupingWindow,
} from '../src/lib/sla-service';

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

function assertEqual<T>(actual: T, expected: T, label?: string) {
  if (actual !== expected) {
    throw new Error(`${label ? label + ': ' : ''}esperado "${expected}", obtido "${actual}"`);
  }
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

console.log('\n🔵 test-sla-calendar.ts\n');

// ── Teste 1: Cálculo dentro do mesmo bloco de expediente ─────────────────────
test('calcBusinessMinutes — 30 min no mesmo bloco (14h00 às 14h30 de quarta)', () => {
  // 02/09/2026 foi uma quarta-feira.
  // Horário de Brasília (UTC-3): 14h00 BRT = 17h00 UTC
  const d1 = new Date('2026-09-02T17:00:00Z'); // 14:00 BRT
  const d2 = new Date('2026-09-02T17:30:00Z'); // 14:30 BRT
  const minutes = calcBusinessMinutes(d1, d2, DEFAULT_SLA_POLICY);
  assertEqual(minutes, 30, 'minutos úteis no mesmo bloco');
});

// ── Teste 2: Intervalo de almoço não conta (11h30 às 13h30) ──────────────────
test('calcBusinessMinutes — ignora intervalo de almoço (11h30 às 13h30 = 60 min úteis)', () => {
  // 11h30 BRT (14h30 UTC) até 13h30 BRT (16h30 UTC)
  // Útil: 11h30 às 12h00 (30 min) + 13h00 às 13h30 (30 min) = 60 min
  const d1 = new Date('2026-09-02T14:30:00Z'); // 11:30 BRT
  const d2 = new Date('2026-09-02T16:30:00Z'); // 13:30 BRT
  const minutes = calcBusinessMinutes(d1, d2, DEFAULT_SLA_POLICY);
  assertEqual(minutes, 60, 'almoço ignorado');
});

// ── Teste 3: CASO REAL BLOQUEADOR — 02/09/2026 às 14h54 até fim do expediente ─
test('CASO REAL — 02/09/2026 das 14h54 às 17h00 = exatamente 126 minutos úteis', () => {
  // 14h54 BRT = 17h54 UTC
  // 17h00 BRT = 20h00 UTC
  const d1 = new Date('2026-09-02T17:54:00Z'); // 14:54 BRT
  const d2 = new Date('2026-09-02T20:00:00Z'); // 17:00 BRT
  const minutes = calcBusinessMinutes(d1, d2, DEFAULT_SLA_POLICY);
  assertEqual(minutes, 126, 'minutos úteis até fim do expediente de 02/09');
});

// ── Teste 4: CASO REAL — Fora do expediente às 19h07 continua sendo 126 min ──
test('CASO REAL — 02/09 às 19h07 (fora de expediente) mantém 126 min úteis e violação de SLA', () => {
  // 14h54 BRT (17h54 UTC) até 19h07 BRT (22h07 UTC)
  const d1 = new Date('2026-09-02T17:54:00Z'); // 14:54 BRT
  const d2 = new Date('2026-09-02T22:07:00Z'); // 19:07 BRT
  const minutes = calcBusinessMinutes(d1, d2, DEFAULT_SLA_POLICY);
  assertEqual(minutes, 126, 'minutos após as 17h00 não somam');

  const status = computeSlaStatus(d1, d2, DEFAULT_SLA_POLICY);
  assertEqual(status.state, 'BREACHED', 'SLA violado (> 30 min)');
  assertEqual(status.business_minutes_elapsed, 126);
});

// ── Teste 5: CASO REAL — 03/09 às 07h17 (17 min úteis após abertura às 07h00) ─
test('CASO REAL — 03/09 às 07h17 soma 126 min de ontem + 17 min de hoje = 143 min úteis', () => {
  // 02/09 14h54 BRT (17h54 UTC) até 03/09 07h17 BRT (10h17 UTC)
  const d1 = new Date('2026-09-02T17:54:00Z'); // 02/09 14:54 BRT
  const d2 = new Date('2026-09-03T10:17:00Z'); // 03/09 07:17 BRT
  const minutes = calcBusinessMinutes(d1, d2, DEFAULT_SLA_POLICY);
  assertEqual(minutes, 143, '126 min de quarta + 17 min de quinta');
});

// ── Teste 6: Fim de semana não consome tempo útil ────────────────────────────
test('calcBusinessMinutes — fim de semana (sábado 10h a domingo 18h) = 0 min úteis', () => {
  // 05/09/2026 (sábado) 10h BRT até 06/09/2026 (domingo) 18h BRT
  const d1 = new Date('2026-09-05T13:00:00Z');
  const d2 = new Date('2026-09-06T21:00:00Z');
  const minutes = calcBusinessMinutes(d1, d2, DEFAULT_SLA_POLICY);
  assertEqual(minutes, 0, 'sábado e domingo');
});

// ── Teste 7: addBusinessMinutes respeita pausas de expediente ─────────────────
test('addBusinessMinutes — 30 min úteis a partir de 14h54 de 02/09 vence às 15h24', () => {
  const start = new Date('2026-09-02T17:54:00Z'); // 14:54 BRT
  const due = addBusinessMinutes(start, 30, DEFAULT_SLA_POLICY);
  // 14h54 + 30 min = 15h24 BRT (18h24 UTC)
  const expected = new Date('2026-09-02T18:24:00Z');
  assertEqual(due.toISOString(), expected.toISOString(), 'vencimento de primeiro contato');
});

// ── Teste 8: Janela de agrupamento de retornos (15 min corridos) ─────────────
test('isWithinGroupingWindow — 10 min corridos retorna true, 20 min retorna false', () => {
  const t1 = new Date('2026-09-02T19:07:00Z');
  const t2 = new Date('2026-09-02T19:17:00Z'); // 10 min depois
  const t3 = new Date('2026-09-02T19:28:00Z'); // 21 min depois
  assert(isWithinGroupingWindow(t1, t2, DEFAULT_SLA_POLICY), '10 min deve agrupar');
  assert(!isWithinGroupingWindow(t1, t3, DEFAULT_SLA_POLICY), '21 min não deve agrupar');
});

console.log(`\n==================================================`);
console.log(`📊 Resultado: ${passed} passaram | ${failed} falharam`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n🎉 Todos os testes de SLA e calendário útil passaram!\n');
}
