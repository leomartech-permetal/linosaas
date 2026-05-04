import { supabase } from './supabase';
import { 
  getLeadFullContext, 
  getLeadMemory,
  saveLeadMemory, 
  updateLeadInfo,
  detectIntentFromMessage,
  extractInfoFromMessage,
  handleSupportInteraction,
  isLeadReturning
} from './support-context';

export interface QualificationData {
  produto?: string;
  segmento?: string;
  marca?: string;
  region?: string;
  nome?: string;
  cargo?: string;
  empresa?: string;
  cnpj?: string;
  email_corporativo?: string;
  cidade_empresa?: string;
  estado_empresa?: string;
  quantidade?: string;
  especificacao?: string;
  observacao?: string;
}

const REQUIRED_QUALIFICATION_FIELDS = ['produto', 'segmento', 'marca', 'region'];

export async function determineConversationMode(
  leadId: string, 
  message: string
): Promise<'SDR' | 'SUPORTE'> {
  const lead = await supabase
    .from('leads')
    .select('qualification_completed, qualified_at, last_mode, status')
    .eq('id', leadId)
    .single();
  
  if (!lead.data) return 'SDR';
  
  if (!lead.data.qualification_completed) {
    return 'SDR';
  }
  
  const isRet = await isLeadReturning(leadId);
  
  if (isRet) {
    await supabase
      .from('leads')
      .update({ last_mode: 'SUPORTE' })
      .eq('id', leadId);
    
    return 'SUPORTE';
  }
  
  return 'SDR';
}

export async function processSDRMessage(
  leadId: string,
  message: string
): Promise<{ response: string; qualification_complete: boolean; intent: string }> {
  const lead = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();
  
  if (!lead.data) {
    return { response: 'Erro ao processar mensagem', qualification_complete: false, intent: 'PRODUTO' };
  }
  
  const intent = detectIntentFromMessage(message);
  
  if (intent !== 'PRODUTO') {
    return {
      response: getRoutingResponse(intent),
      qualification_complete: false,
      intent
    };
  }
  
  const memory = await getLeadMemory(leadId);
  const extracted = extractInfoFromMessage(message, memory);
  
  for (const [key, value] of Object.entries(extracted)) {
    await saveLeadMemory(leadId, key, value, 'extracted', 8);
  }
  
  const currentData = lead.data;
  const qualificationStatus = checkQualificationComplete(currentData);
  
  if (qualificationStatus.complete) {
    await supabase
      .from('leads')
      .update({
        qualification_completed: true,
        qualified_at: new Date(),
        intent_type: 'PRODUTO',
        updated_at: new Date()
      })
      .eq('id', leadId);
    
    return {
      response: generateClosingMessage(currentData.name),
      qualification_complete: true,
      intent: 'PRODUTO'
    };
  }
  
  const nextQuestion = getNextQualificationQuestion(currentData, memory);
  
  return {
    response: nextQuestion,
    qualification_complete: false,
    intent: 'PRODUTO'
  };
}

function checkQualificationComplete(leadData: any): { complete: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!leadData.produto) missing.push('produto');
  if (!leadData.aplicacao && !leadData.segmento) missing.push('segmento');
  if (!leadData.marca_id) missing.push('marca');
  if (!leadData.ddd && !leadData.region_id) missing.push('region');
  
  return { complete: missing.length === 0, missing };
}

function getNextQualificationQuestion(leadData: any, memory: any[]): string {
  const memoryMap = memory.reduce((acc, m) => ({ ...acc, [m.key]: m.value }), {});
  
  const questions: Record<string, string> = {
    produto: 'Qual produto você procura? Posso ajudar a encontrar o ideal para sua necessidade.',
    segmento: 'Qual é o segmento de atuação da sua empresa? (construção civil, indústria, revenda, outro)',
    marca: 'Você tem alguma marca preferida?',
    region: 'Para melhor atendê-lo, qual é sua região ou DDD?',
  };
  
  for (const field of REQUIRED_QUALIFICATION_FIELDS) {
    if (field === 'produto' && !leadData.produto && !memoryMap.produto) {
      return questions.produto;
    }
    if (field === 'segmento' && !leadData.aplicacao && !memoryMap.segmento) {
      return questions.segmento;
    }
    if (field === 'region' && !leadData.ddd && !memoryMap.ddd && !memoryMap.cidade) {
      return questions.region;
    }
  }
  
  return 'Posso perguntar: qual a quantidade aproximada que você precisa?';
}

function generateClosingMessage(name?: string): string {
  const formattedName = name ? `, ${name}` : '';
  return `Agradeço as informações${formattedName}! Agora vou passar tudo para um dos nossos especialistas que entrará em contato em breve.`;
}

function getRoutingResponse(intent: string): string {
  const routingMessages: Record<string, string> = {
    'VAGAS': 'Entendi! Você está interessado(a) em trabalhar conosco. Vou registrar seu interesse e nossa área de RH entrará em contato.',
    'FORNECEDOR': 'Entendi! Você gostaria de ser nosso fornecedor. Vou passar seu contato para nossa área de compras.',
    'LOGISTICA': 'Entendi! Para informações sobre logística e entregas, vou notificar nosso time. Já posso pedir seu contato para eles retornarem.',
    'FINANCEIRO': 'Entendi! Você precisa falar com nosso financeiro. Vou notificar o setor para retornarem seu contato.',
    'COMEX': 'Entendi! Você tem dúvidas sobre importação/exportação. Vou passar para nosso time de comércio exterior.',
    'MARKETING': 'Entendi! Você tem interesse em parceria ou marketing. Vou notificar nossa equipe.',
    'OUTRO': 'Entendi! Vou registrar sua demanda e direcionar para o especialista correto.'
  };
  
  return routingMessages[intent] || routingMessages['OUTRO'];
}

export async function processSupportMessage(
  leadId: string,
  message: string,
  ownerId: string | null,
  teamId: string | null
): Promise<{ response: string; escalated: boolean }> {
  const result = await handleSupportInteraction(leadId, message, ownerId, teamId);
  
  if (result.should_escalate) {
    return {
      response: `Entendo sua ansiedade. Já notifiquei nosso líder sobre seu caso para garantir que você seja atendido rapidamente. Em breve ele entrará em contato.`,
      escalated: true
    };
  }
  
  const lead = await supabase
    .from('leads')
    .select('name, produto, empresa')
    .eq('id', leadId)
    .single();
  
  const leadName = lead.data?.name || 'cliente';
  const attempts = result.attempt_count || 1;
  
  return {
    response: `Entendi, ${leadName}. Já notifiquei o vendedor novamente sobre seu caso (tentativa ${attempts}). Por favor, aguarde mais um momento.`,
    escalated: false
  };
}

export async function updateLeadQualification(
  leadId: string,
  data: QualificationData
): Promise<boolean> {
  const updateData: Record<string, any> = {};
  
  if (data.produto) updateData.produto = data.produto;
  if (data.segmento) updateData.aplicacao = data.segmento;
  if (data.nome) updateData.name = data.nome;
  if (data.cargo) updateData.cargo = data.cargo;
  if (data.empresa) updateData.empresa = data.empresa;
  if (data.cnpj) updateData.cnpj = data.cnpj;
  if (data.email_corporativo) updateData.email_corporativo = data.email_corporativo;
  if (data.cidade_empresa) updateData.cidade_empresa = data.cidade_empresa;
  if (data.estado_empresa) updateData.estado_empresa = data.estado_empresa;
  if (data.quantidade) updateData.quantidade = data.quantidade;
  if (data.especificacao) updateData.especificacao = data.especificacao;
  if (data.observacao) updateData.observacao = data.observacao;
  
  const { error } = await supabase
    .from('leads')
    .update(updateData)
    .eq('id', leadId);
  
  return !error;
}

export function buildContextForAI(leadId: string): string {
  return '';
}