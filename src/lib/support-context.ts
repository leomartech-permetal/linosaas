import { supabase } from './supabase';

export interface LeadMemory {
  key: string;
  value: string;
  type: 'answered' | 'extracted' | 'confirmed';
  importance: number;
}

export interface LeadFullContext {
  lead: any;
  memory: LeadMemory[];
  recent_interactions: any[];
  follow_ups: any[];
  owner: any;
  brand: any;
  region: any;
}

export interface SupportResult {
  success: boolean;
  message: string;
  attempt_count?: number;
  should_escalate?: boolean;
  escalation_result?: any;
}

const MAX_SUPPORT_ATTEMPTS = 3;

export async function getLeadMemory(leadId: string): Promise<LeadMemory[]> {
  const { data, error } = await supabase
    .rpc('get_lead_memory', { p_lead_id: leadId });
  
  if (error) {
    console.error('Error getting lead memory:', error);
    return [];
  }
  
  return data || [];
}

export async function saveLeadMemory(
  leadId: string,
  key: string,
  value: string,
  type: 'extracted' | 'answered' | 'confirmed' = 'extracted',
  importance: number = 5
): Promise<string | null> {
  const { data, error } = await supabase
    .rpc('save_lead_memory', {
      p_lead_id: leadId,
      p_memory_key: key,
      p_memory_value: value,
      p_memory_type: type,
      p_importance: importance
    });
  
  if (error) {
    console.error('Error saving lead memory:', error);
    return null;
  }
  
  return data;
}

export async function getLeadFullContext(leadId: string): Promise<LeadFullContext | null> {
  const { data, error } = await supabase
    .rpc('get_lead_full_context', { p_lead_id: leadId });
  
  if (error) {
    console.error('Error getting lead context:', error);
    return null;
  }
  
  return data;
}

export async function updateLeadInfo(
  leadId: string,
  info: {
    name?: string;
    cargo?: string;
    empresa?: string;
    cnpj?: string;
    email?: string;
    cidade?: string;
    estado?: string;
    quantidade?: string;
    especificacao?: string;
    observacao?: string;
    produto?: string;
    segmento?: string;
  }
): Promise<SupportResult> {
  const { data, error } = await supabase
    .rpc('update_lead_info', {
      p_lead_id: leadId,
      p_name: info.name,
      p_cargo: info.cargo,
      p_empresa: info.empresa,
      p_cnpj: info.cnpj,
      p_email: info.email,
      p_cidade: info.cidade,
      p_estado: info.estado,
      p_quantidade: info.quantidade,
      p_especificacao: info.especificacao,
      p_observacao: info.observacao,
      p_produto: info.produto,
      p_segmento: info.segmento
    });
  
  if (error) {
    console.error('Error updating lead info:', error);
    return { success: false, message: 'Erro ao atualizar informações' };
  }
  
  return { success: true, message: 'Informações atualizadas com sucesso' };
}

export async function completeQualification(leadId: string): Promise<SupportResult> {
  const { data, error } = await supabase
    .rpc('complete_qualification', { p_lead_id: leadId });
  
  if (error) {
    console.error('Error completing qualification:', error);
    return { success: false, message: 'Erro ao concluir qualificação' };
  }
  
  return { success: true, message: 'Qualificação concluída' };
}

export async function isLeadReturning(leadId: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('is_lead_returning', { p_lead_id: leadId });
  
  if (error) {
    console.error('Error checking if lead is returning:', error);
    return false;
  }
  
  return data || false;
}

export async function handleSupportInteraction(
  leadId: string,
  userMessage: string,
  ownerId: string | null,
  teamId: string | null
): Promise<SupportResult> {
  const isReturning = await isLeadReturning(leadId);
  
  if (!isReturning) {
    return { 
      success: false, 
      message: 'Lead não retornou - modo SDR ativo',
      should_escalate: false 
    };
  }
  
  const { data: lead } = await supabase
    .from('leads')
    .select('support_attempts')
    .eq('id', leadId)
    .single();
  
  if (!lead) {
    return { success: false, message: 'Lead não encontrado' };
  }
  
  const newAttemptCount = lead.support_attempts + 1;
  
  await supabase
    .from('leads')
    .update({ 
      support_attempts: newAttemptCount,
      last_mode: 'SUPORTE',
      updated_at: new Date()
    })
    .eq('id', leadId);
  
  await supabase
    .from('lead_follow_ups')
    .insert({
      lead_id: leadId,
      assigned_user_id: ownerId,
      team_id: teamId,
      attempt_number: newAttemptCount,
      status: 'PENDING'
    });
  
  const shouldEscalate = newAttemptCount >= MAX_SUPPORT_ATTEMPTS;
  
  if (shouldEscalate) {
    const escalationResult = await escalateToManager(
      leadId, 
      `Lead aguardando atendimento há ${newAttemptCount} tentativas`
    );
    
    return {
      success: true,
      message: 'Lead escalado para gestor após 3 tentativas',
      attempt_count: newAttemptCount,
      should_escalate: true,
      escalation_result: escalationResult
    };
  }
  
  return {
    success: true,
    message: `Tentativa ${newAttemptCount} registrada`,
    attempt_count: newAttemptCount,
    should_escalate: false
  };
}

export async function escalateToManager(
  leadId: string,
  reason: string
): Promise<any> {
  const { data, error } = await supabase
    .rpc('escalate_to_manager', {
      p_lead_id: leadId,
      p_reason: reason
    });
  
  if (error) {
    console.error('Error escalating to manager:', error);
    return { success: false, message: 'Erro ao escalar para gestor' };
  }
  
  return data;
}

export async function checkAndEscalateIfNeeded(leadId: string): Promise<SupportResult> {
  const { data: lead } = await supabase
    .from('leads')
    .select('support_attempts, status')
    .eq('id', leadId)
    .single();
  
  if (!lead) {
    return { success: false, message: 'Lead não encontrado' };
  }
  
  if (lead.support_attempts >= MAX_SUPPORT_ATTEMPTS && lead.status !== 'ESCALATED_TO_MANAGER') {
    return await escalateToManager(leadId, 'Limite de tentativas atingido automaticamente');
  }
  
  return { success: true, message: 'Não precisa escalar' };
}

export function detectIntentFromMessage(message: string): string {
  const lowerMessage = message.toLowerCase();
  
  const intentPatterns: Record<string, string[]> = {
    'VAGAS': ['vaga', 'emprego', 'trabalhar', 'contratação', 'processo seletivo', ' Hiring'],
    'FORNECEDOR': ['fornecedor', 'vender', 'fornecer', 'parceria', 'fornecimento'],
    'LOGISTICA': ['entrega', 'frete', 'prazo', 'logística', 'shipping', 'transportadora'],
    'FINANCEIRO': ['pagamento', 'boleto', 'fatura', 'financeiro', 'contas', 'valor'],
    'COMEX': ['importação', 'exportação', 'comex', 'alfândega', 'shipping international'],
    'MARKETING': ['marketing', 'parceria', 'publicidade', 'propaganda', 'divulgação'],
  };
  
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    if (patterns.some(p => lowerMessage.includes(p))) {
      return intent;
    }
  }
  
  return 'PRODUTO';
}

export function extractInfoFromMessage(
  message: string,
  currentMemory: LeadMemory[]
): Record<string, string> {
  const extracted: Record<string, string> = {};
  
  const patterns: Record<string, RegExp> = {
    nome: /(?:meu nome é|sou|chamo|identificado como)\s+([A-Za-zÀ-ÿ\s]+?)(?:\.|,|\s|$)/i,
    empresa: /(?:empresa|companhia|companhia|trabalho na|da|na)\s+([A-Za-zÀ-ÿ\s]+?)(?:\.|,|\s|$)/i,
    cnpj: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/,
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    produto: /(?:produto|procuro|quero|preciso de|busco)\s+([A-Za-zÀ-ÿ\s]+?)(?:\.|,|\s|$)/i,
    quantidade: /(?:quantidade|qtd|quantos|vai precisar|m²|metros|peças|unidades)\s+(\d+[\s,]?\d*)/i,
    cidade: /(?:cidade|local|localização|onde estou|em|from)\s+([A-Za-zÀ-ÿ\s]+?)(?:\.|,|\s|$)/i,
  };
  
  for (const [key, pattern] of Object.entries(patterns)) {
    if (!currentMemory.find(m => m.key === key)) {
      const match = message.match(pattern);
      if (match) {
        extracted[key] = match[1] || match[0];
      }
    }
  }
  
  return extracted;
}