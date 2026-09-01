export type FlowMode = 'SDR' | 'SUPORTE' | 'POS_VENDA';

export interface LeadState {
  id: string;
  status?: string;
  qualification_completed?: boolean;
  name?: string;
  current_owner_id?: string;
  created_at?: string;
  assigned_user?: {
    id?: string;
    name?: string;
    whatsapp_number?: string;
  };
}

export interface IntentDecision {
  mode: FlowMode;
  reason: string;
  shouldAlertSla: boolean;
  alertDetails?: string;
}

const POS_VENDA_KEYWORDS = [
  'já comprei',
  'ja comprei',
  'já comprei',
  'meu pedido',
  'número do pedido',
  'numero do pedido',
  'nota fiscal',
  'danfe',
  'xml',
  'rastreio',
  'rastreamento',
  'onde está a entrega',
  'previsão de entrega',
  'veio errado',
  'veio com defeito',
  'recompra',
  'segunda via',
  'faturado',
  'boleto',
  'comprovante'
];

const COBRANCA_SUPORTE_KEYWORDS = [
  'ninguém me chamou',
  'ninguem me chamou',
  'ninguém me atendeu',
  'estou aguardando',
  'estou esperando',
  'cadê o vendedor',
  'cade o vendedor',
  'não recebi contato',
  'nao recebi contato',
  'demora',
  'muito demorado',
  'urgente',
  'preciso com urgência',
  'alguém online',
  'algum vendedor'
];

/**
 * Classifica a intenção de retorno do lead entre SDR, Suporte (SLA) ou Pós-Venda
 */
export function classifyReturnIntent(message: string, lead: LeadState): IntentDecision {
  const clean = (message || '').toLowerCase();

  // 1. Detecção de Pós-Venda (independente do status, se menciona pedido já existente)
  const isPosVenda = POS_VENDA_KEYWORDS.some(kw => clean.includes(kw));
  if (isPosVenda || lead.status === 'FECHADO' || lead.status === 'CONVERTIDO' || lead.status === 'POS_VENDA') {
    return {
      mode: 'POS_VENDA',
      reason: 'Termos de pós-venda/entrega/NF detectados ou lead já cliente',
      shouldAlertSla: false
    };
  }

  // 2. Lead em fila de espera do vendedor (WAITING_SELLER ou EM_ATENDIMENTO)
  const isWaitingSeller = lead.status === 'WAITING_SELLER' || 
                          lead.status === 'EM_ATENDIMENTO' || 
                          lead.qualification_completed === true;

  if (isWaitingSeller) {
    const isCobranca = COBRANCA_SUPORTE_KEYWORDS.some(kw => clean.includes(kw));
    return {
      mode: 'SUPORTE',
      reason: isCobranca ? 'Cliente cobrando atendimento de vendedor em fila' : 'Cliente aguardando retorno do consultor',
      shouldAlertSla: isCobranca,
      alertDetails: isCobranca ? 'Cliente retornou cobrando resposta do consultor' : undefined
    };
  }

  // 3. Lead em qualificação incompleta -> Fluxo SDR
  return {
    mode: 'SDR',
    reason: 'Lead em triagem/qualificação comercial pendente',
    shouldAlertSla: false
  };
}
