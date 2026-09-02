/**
 * MOTOR DE QUALIFICAÇÃO DETERMINÍSTICO v3
 *
 * Implementa o schema base_sdr.draft.json do pacote v3.0.0.
 * A IA sugere campos coletados; o BACKEND valida se a qualificação
 * pode ser concluída segundo as regras do schema.
 *
 * PRINCÍPIO: "completion_authority: backend"
 * A IA NUNCA declara qualificacao_concluida por si mesma.
 * O motor valida os campos obrigatórios e retorna isComplete=true/false.
 *
 * ESTADOS DE CAMPO:
 *   COLLECTED   → campo presente e válido
 *   INVALID     → campo presente mas não passou validação
 *   REFUSED     → lead recusou explicitamente (max_attempts atingido)
 *   NEEDS_SPEC  → técnico deve avaliar
 *   MISSING     → ainda não coletado
 */

// ─── SCHEMA BASE SDR v3 ───────────────────────────────────────────────────────

export interface FieldDefinition {
  key: string;
  label: string;
  type: string;
  required: boolean;
  required_when?: string;
  allowed_values?: string[];
  max_attempts: number | null;
  blocks_handoff: boolean | 'conditional';
}

export const SDR_BASE_SCHEMA_V3: FieldDefinition[] = [
  {
    key: 'product_id',
    label: 'Produto',
    type: 'product_reference',
    required: true,
    max_attempts: null,
    blocks_handoff: true,
  },
  {
    key: 'segment_id',
    label: 'Segmento',
    type: 'enum_reference',
    required: true,
    max_attempts: null,
    blocks_handoff: true,
  },
  {
    key: 'quantity',
    label: 'Quantidade ou metragem com unidade',
    type: 'quantity_with_unit',
    required: true,
    max_attempts: null,
    blocks_handoff: true,
  },
  {
    key: 'technical_resolution',
    label: 'Situação da especificação técnica',
    type: 'enum',
    allowed_values: ['PROVIDED', 'PARTIAL', 'NEEDS_SPECIALIST'],
    required: true,
    max_attempts: null,
    blocks_handoff: true,
  },
  {
    key: 'application_summary',
    label: 'Aplicação e contexto',
    type: 'string',
    required: false,
    max_attempts: 1,
    blocks_handoff: false,
  },
  {
    key: 'contact_name',
    label: 'Nome',
    type: 'string',
    required: false,
    max_attempts: 2,
    blocks_handoff: false,
  },
  {
    key: 'company',
    label: 'Empresa',
    type: 'string',
    required: false,
    max_attempts: 2,
    blocks_handoff: false,
  },
  {
    key: 'cnpj',
    label: 'CNPJ',
    type: 'cnpj',
    required: false,
    max_attempts: 2,
    blocks_handoff: false,
  },
  {
    key: 'email',
    label: 'E-mail corporativo',
    type: 'email',
    required: false,
    max_attempts: 2,
    blocks_handoff: false,
  },
  {
    key: 'project_location',
    label: 'Cidade e UF da obra ou entrega',
    type: 'location',
    required: false,
    required_when: 'routing_requires_confirmed_location',
    max_attempts: 2,
    blocks_handoff: 'conditional',
  },
];

// ─── TIPOS DE ESTADO ──────────────────────────────────────────────────────────

export type FieldState =
  | 'COLLECTED'
  | 'INVALID'
  | 'REFUSED'
  | 'NEEDS_SPECIALIST'
  | 'MISSING';

export interface FieldSnapshot {
  key: string;
  state: FieldState;
  value?: any;
  attempts: number;
  lastUpdated?: string;
}

export interface QualificationResult {
  isComplete: boolean;
  missingRequired: string[];
  blockingFields: string[];
  fieldSnapshots: FieldSnapshot[];
  score: number;              // 0–100 (percentual de campos coletados)
  readyForRouting: boolean;   // true apenas quando isComplete e sem bloqueios
  reason?: string;            // motivo se não está completo
}

// ─── VALIDADORES DE CAMPO ─────────────────────────────────────────────────────

function validateField(field: FieldDefinition, value: any): boolean {
  if (value === null || value === undefined || value === '') return false;

  switch (field.type) {
    case 'product_reference':
    case 'enum_reference':
    case 'string':
    case 'location':
      return typeof value === 'string' && value.trim().length > 0;

    case 'enum':
      return (field.allowed_values || []).includes(String(value).toUpperCase());

    case 'quantity_with_unit':
      // Aceita: "100m²", "50 metros", "200 chapas", "500kg"
      return typeof value === 'string' &&
        /\d+/.test(value) &&
        /[a-zA-Zçãõ²³]/.test(value);

    case 'cnpj': {
      const digits = String(value).replace(/\D/g, '');
      return digits.length === 14;
    }

    case 'email':
      return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

    default:
      return true;
  }
}

// ─── MOTOR PRINCIPAL ──────────────────────────────────────────────────────────

/**
 * Avalia se a qualificação de um lead está completa.
 *
 * @param collectedFields - Campos coletados pela IA (chave → valor)
 * @param fieldStates     - Estados persistidos por campo (do banco)
 * @param routingRequiresLocation - Se o roteamento exige cidade/UF confirmada
 */
export function evaluateQualification(
  collectedFields: Record<string, any>,
  fieldStates: Record<string, FieldSnapshot>,
  routingRequiresLocation = false
): QualificationResult {
  const snapshots: FieldSnapshot[] = [];
  const missingRequired: string[] = [];
  const blockingFields: string[] = [];

  let collectedCount = 0;
  const totalFields = SDR_BASE_SCHEMA_V3.length;

  for (const field of SDR_BASE_SCHEMA_V3) {
    const existing = fieldStates[field.key];
    const value = collectedFields[field.key];
    const attempts = existing?.attempts || 0;

    let state: FieldState = existing?.state || 'MISSING';

    // Se tem valor novo da IA, validar
    if (value !== undefined && value !== null && value !== '') {
      const isValid = validateField(field, value);
      state = isValid ? 'COLLECTED' : 'INVALID';
    }

    // Verificar max_attempts (campo não obrigatório pode ser marcado como REFUSED)
    if (
      state === 'MISSING' &&
      field.max_attempts !== null &&
      attempts >= field.max_attempts
    ) {
      state = 'REFUSED';
    }

    // Produto especificado com "NEEDS_SPECIALIST" → estado especial
    if (field.key === 'technical_resolution' && value === 'NEEDS_SPECIALIST') {
      state = 'NEEDS_SPECIALIST';
    }

    const snapshot: FieldSnapshot = {
      key: field.key,
      state,
      value: value ?? existing?.value,
      attempts,
      lastUpdated: state !== existing?.state ? new Date().toISOString() : existing?.lastUpdated,
    };

    snapshots.push(snapshot);

    // Contar coletados
    if (state === 'COLLECTED' || state === 'NEEDS_SPECIALIST') {
      collectedCount++;
    }

    // Verificar obrigatoriedade com blocks_handoff
    const isRequiredNow =
      field.required ||
      (field.key === 'project_location' && routingRequiresLocation);

    const blocksHandoffNow =
      field.blocks_handoff === true ||
      (field.blocks_handoff === 'conditional' && routingRequiresLocation);

    if (blocksHandoffNow && state !== 'COLLECTED' && state !== 'NEEDS_SPECIALIST') {
      blockingFields.push(field.key);
    }

    if (isRequiredNow && state !== 'COLLECTED' && state !== 'NEEDS_SPECIALIST') {
      missingRequired.push(field.key);
    }
  }

  const isComplete = blockingFields.length === 0;
  const score = Math.round((collectedCount / totalFields) * 100);

  let reason: string | undefined;
  if (!isComplete) {
    reason = `Campos bloqueantes pendentes: ${blockingFields.join(', ')}`;
  }

  return {
    isComplete,
    missingRequired,
    blockingFields,
    fieldSnapshots: snapshots,
    score,
    readyForRouting: isComplete,
    reason,
  };
}

/**
 * Converte snapshots em Record para persistência no banco.
 */
export function snapshotsToRecord(
  snapshots: FieldSnapshot[]
): Record<string, FieldSnapshot> {
  return Object.fromEntries(snapshots.map((s) => [s.key, s]));
}

/**
 * Retorna apenas os campos ainda pendentes de coleta (para guiar a IA).
 * Ordena por prioridade: obrigatórios primeiro, depois opcionais.
 */
export function getPendingFields(snapshots: FieldSnapshot[]): FieldDefinition[] {
  const stateMap = Object.fromEntries(snapshots.map((s) => [s.key, s.state]));

  return SDR_BASE_SCHEMA_V3.filter((f) => {
    const state = stateMap[f.key] || 'MISSING';
    return state === 'MISSING' || state === 'INVALID';
  }).sort((a, b) => {
    // Obrigatórios primeiro
    if (a.required && !b.required) return -1;
    if (!a.required && b.required) return 1;
    return 0;
  });
}
