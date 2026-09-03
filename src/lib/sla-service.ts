/**
 * LINO SLA SERVICE — Calendário Útil Determinístico v1
 *
 * Regras de negócio configuradas via sla_policies no banco.
 * Defaults iniciais Permetal:
 *   - Seg-Qui: 07:00–12:00 e 13:00–17:00
 *   - Sex:     07:00–12:00 e 13:00–16:00
 *   - Primeiro contato do vendedor: 30 minutos úteis
 *   - Agrupamento de retornos: 15 minutos corridos
 *   - Escalada dura: 4 horas úteis ou 5 retornos
 *
 * IMPORTANTE: nunca deixar o LLM calcular SLA.
 */

export interface SlaPolicy {
  first_contact_minutes: number;       // minutos úteis para primeiro contato
  grouping_window_minutes: number;     // janela de agrupamento de retornos (corridos)
  escalate_after_returns: number;      // número de retornos/cobranças para escalada (default 3x)
  hard_escalate_minutes: number;       // minutos úteis para escalada dura (default 240 min)
  min_minutes_between_charges: number; // intervalo mínimo entre cobranças ao vendedor (default 10 min)
  timezone: string;
  work_schedule: WorkSchedule;
  holidays: string[];                  // datas no formato 'YYYY-MM-DD'
}

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type TimeRange = [string, string]; // ex: ['07:00', '12:00']
export type WorkSchedule = Record<DayKey, TimeRange[]>;

export interface SlaStatus {
  business_minutes_elapsed: number;
  first_contact_due_at: Date;
  hard_escalate_due_at: Date;
  state: 'WITHIN_SLA' | 'AT_RISK' | 'BREACHED';
}

const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Políticas padrão Permetal quando o banco não retornar política ativa */
export const DEFAULT_SLA_POLICY: SlaPolicy = {
  first_contact_minutes: 30,
  grouping_window_minutes: 15,
  escalate_after_returns: 3,         // Máximo de 3 cobranças antes de escalar
  hard_escalate_minutes: 240,
  min_minutes_between_charges: 10,   // Mínimo de 10 minutos entre notificações ao vendedor
  timezone: 'America/Sao_Paulo',
  work_schedule: {
    mon: [['07:00', '12:00'], ['13:00', '17:00']],
    tue: [['07:00', '12:00'], ['13:00', '17:00']],
    wed: [['07:00', '12:00'], ['13:00', '17:00']],
    thu: [['07:00', '12:00'], ['13:00', '17:00']],
    fri: [['07:00', '12:00'], ['13:00', '16:00']],
    sat: [],
    sun: [],
  },
  holidays: [],
};

/**
 * Converte uma data para o timezone configurado e retorna o objeto Date local.
 */
function toTz(date: Date, tz: string): Date {
  // Usamos Intl para extrair partes da data no timezone alvo
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
  const local = new Date(
    Date.UTC(
      parseInt(get('year')),
      parseInt(get('month')) - 1,
      parseInt(get('day')),
      parseInt(get('hour')),
      parseInt(get('minute')),
      parseInt(get('second'))
    )
  );
  // Offset: diferença entre UTC e local
  const offset = date.getTime() - local.getTime();
  return new Date(date.getTime() - offset);
}

/**
 * Verifica se uma data é feriado.
 */
function isHoliday(date: Date, holidays: string[], tz: string): boolean {
  const tzDate = toTz(date, tz);
  const ymd = tzDate.toISOString().slice(0, 10);
  return holidays.includes(ymd);
}

/**
 * Retorna os segmentos de tempo útil disponíveis em um dia no timezone da política.
 * Retorna lista de [Date, Date] em UTC representando intervalos de trabalho no dia.
 */
function getWorkSegmentsForDay(
  date: Date,
  policy: SlaPolicy
): Array<[Date, Date]> {
  const tzDate = toTz(date, policy.timezone);
  const dayKey = DAY_KEYS[tzDate.getDay()];
  const ranges = policy.work_schedule[dayKey] ?? [];

  if (!ranges.length || isHoliday(date, policy.holidays, policy.timezone)) {
    return [];
  }

  const year = tzDate.getFullYear();
  const month = tzDate.getMonth();
  const day = tzDate.getDate();
  const offset = date.getTime() - tzDate.getTime();

  return ranges.map(([start, end]) => {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    return [
      new Date(Date.UTC(year, month, day, sh, sm, 0) + offset),
      new Date(Date.UTC(year, month, day, eh, em, 0) + offset),
    ] as [Date, Date];
  });
}

/**
 * Calcula quantos minutos úteis decorreram entre `from` e `to`.
 * Usa a política de calendário para determinar horários de trabalho.
 */
export function calcBusinessMinutes(
  from: Date,
  to: Date,
  policy: SlaPolicy = DEFAULT_SLA_POLICY
): number {
  if (to <= from) return 0;

  let total = 0;
  const cursor = new Date(from);

  // Iterar dia a dia para evitar loop infinito em períodos longos
  while (cursor < to) {
    const segments = getWorkSegmentsForDay(cursor, policy);
    for (const [segStart, segEnd] of segments) {
      const overlapStart = new Date(Math.max(cursor.getTime(), segStart.getTime(), from.getTime()));
      const overlapEnd = new Date(Math.min(segEnd.getTime(), to.getTime()));
      if (overlapEnd > overlapStart) {
        total += (overlapEnd.getTime() - overlapStart.getTime()) / 60000;
      }
    }
    // Avançar cursor para o próximo dia
    const tzCursor = toTz(cursor, policy.timezone);
    const nextDay = new Date(tzCursor);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);
    const offset = cursor.getTime() - tzCursor.getTime();
    cursor.setTime(nextDay.getTime() + offset);
  }

  return Math.round(total);
}

/**
 * Calcula a data/hora em que `businessMinutes` minutos úteis se esgotam a partir de `from`.
 */
export function addBusinessMinutes(
  from: Date,
  businessMinutes: number,
  policy: SlaPolicy = DEFAULT_SLA_POLICY
): Date {
  let remaining = businessMinutes;
  const cursor = new Date(from);
  const maxDays = 30; // proteção contra loop infinito
  let days = 0;

  while (remaining > 0 && days < maxDays) {
    const segments = getWorkSegmentsForDay(cursor, policy);
    for (const [segStart, segEnd] of segments) {
      const workStart = new Date(Math.max(cursor.getTime(), segStart.getTime(), from.getTime()));
      if (workStart >= segEnd) continue;
      const available = (segEnd.getTime() - workStart.getTime()) / 60000;
      if (available >= remaining) {
        return new Date(workStart.getTime() + remaining * 60000);
      }
      remaining -= available;
      cursor.setTime(segEnd.getTime());
    }

    // Avançar para próximo dia
    const tzCursor = toTz(cursor, policy.timezone);
    const nextDay = new Date(tzCursor);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);
    const offset = cursor.getTime() - tzCursor.getTime();
    cursor.setTime(nextDay.getTime() + offset);
    days++;
  }

  // Se esgotou dias, retornar cursor atual
  return cursor;
}

/**
 * Calcula o status de SLA completo para um atendimento.
 */
export function computeSlaStatus(
  assignedAt: Date,
  now: Date,
  policy: SlaPolicy = DEFAULT_SLA_POLICY
): SlaStatus {
  const elapsed = calcBusinessMinutes(assignedAt, now, policy);
  const firstContactDueAt = addBusinessMinutes(assignedAt, policy.first_contact_minutes, policy);
  const hardEscalateDueAt = addBusinessMinutes(assignedAt, policy.hard_escalate_minutes, policy);

  let state: SlaStatus['state'];
  if (elapsed >= policy.first_contact_minutes) {
    state = 'BREACHED';
  } else if (elapsed >= policy.first_contact_minutes * 0.75) {
    // Risco: 75% do SLA consumido
    state = 'AT_RISK';
  } else {
    state = 'WITHIN_SLA';
  }

  return {
    business_minutes_elapsed: elapsed,
    first_contact_due_at: firstContactDueAt,
    hard_escalate_due_at: hardEscalateDueAt,
    state,
  };
}

/**
 * Verifica se dois timestamps caem dentro da janela de agrupamento de retornos.
 */
export function isWithinGroupingWindow(
  a: Date,
  b: Date,
  policy: SlaPolicy = DEFAULT_SLA_POLICY
): boolean {
  const diffMs = Math.abs(b.getTime() - a.getTime());
  return diffMs <= policy.grouping_window_minutes * 60000;
}
