import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { 
  extractTechnicalAttributes, 
  getFacetedCatalogOptions, 
  formatFacetedContextForPrompt 
} from './catalog-faceted';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface B2BFieldConfig {
  key: string;
  label: string;
  obrigatorio: boolean;
  max_tentativas: number;
}

/**
 * processLeadWithSkills — Motor central SDR com Schema B2B Inteligente e RAG E-commerce
 */
export async function processLeadWithSkills(
  history: { sender_type: string; message_content: string }[],
  leadId?: string
) {
  // 1. Configurações e chave OpenAI
  const { data: config } = await supabase.from('tenant_config').select('*').limit(1).single();
  const apiKey = config?.openai_key || process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'fake-key') {
    return { erro_openai: 'Chave da OpenAI não configurada.' };
  }

  const openai = new OpenAI({ apiKey });

  // 2. Recuperar dados do Lead
  let leadData: any = null;
  let detectedProduct: string | null = null;
  let b2bAttempts: Record<string, number> = { cnpj: 0, email: 0, nome: 0, empresa: 0 };

  // Schema B2B padrão (pode ser sobrescrito por produto ou tenant)
  let schemaB2BFields: B2BFieldConfig[] = [
    { key: 'produto', label: 'Produto / Família', obrigatorio: true, max_tentativas: 99 },
    { key: 'quantidade', label: 'Quantidade / Metragem', obrigatorio: true, max_tentativas: 99 },
    { key: 'especificacao', label: 'Especificação Técnica', obrigatorio: true, max_tentativas: 99 },
    { key: 'nome_cliente', label: 'Nome do Contato', obrigatorio: false, max_tentativas: 2 },
    { key: 'empresa', label: 'Nome da Empresa', obrigatorio: false, max_tentativas: 2 },
    { key: 'cnpj', label: 'CNPJ', obrigatorio: false, max_tentativas: 2 },
    { key: 'email', label: 'E-mail Corporativo', obrigatorio: false, max_tentativas: 2 }
  ];

  if (leadId) {
    const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();
    if (lead) {
      leadData = lead;
      detectedProduct = lead.detected_product || lead.produto || null;
      if (lead.b2b_attempts && typeof lead.b2b_attempts === 'object') {
        b2bAttempts = { ...b2bAttempts, ...lead.b2b_attempts };
      }

      // Buscar schema específico se cadastrado
      if (detectedProduct) {
        const { data: prod } = await supabase
          .from('products')
          .select('qualification_schema')
          .ilike('name', `%${detectedProduct}%`)
          .limit(1)
          .maybeSingle();

        if (prod?.qualification_schema?.campos) {
          schemaB2BFields = prod.qualification_schema.campos;
        } else if (prod?.qualification_schema?.obrigatorias) {
          // Normalizar formato legado
          const obrigatorias = prod.qualification_schema.obrigatorias as string[];
          schemaB2BFields = schemaB2BFields.map(f => ({
            ...f,
            obrigatorio: obrigatorias.includes(f.key)
          }));
        }
      }
    }
  }

  // 3. RAG E-COMMERCE FACETADO
  const ultimaMsg = history[history.length - 1]?.message_content || '';
  const todoHistoricoTexto = history.map(h => h.message_content).join(' ');
  const technicalDetected = extractTechnicalAttributes(todoHistoricoTexto);

  const facetCriteria = {
    familia: technicalDetected.familia || (detectedProduct?.toLowerCase().includes('expandid') ? 'chapa_expandida' : undefined),
    malha_a: technicalDetected.malha_a,
    malha_b: technicalDetected.malha_b,
    material: technicalDetected.material,
    espessura: technicalDetected.espessura
  };

  const catalogFacets = await getFacetedCatalogOptions(facetCriteria);
  const catalogoEcommerceContexto = formatFacetedContextForPrompt(catalogFacets, technicalDetected);

  // 4. Preparar Regras de Persistência do Schema B2B
  const qStateValores = leadData?.qualification_state?.valores || {};
  const dadosCadastrados: Record<string, any> = {
    nome_cliente: leadData?.name || qStateValores.nome_cliente || null,
    empresa: leadData?.company || qStateValores.empresa || null,
    cnpj: leadData?.cnpj || qStateValores.cnpj || null,
    email: leadData?.email_corporativo || qStateValores.email || null,
    produto: detectedProduct || qStateValores.produto || technicalDetected.familia || null,
    quantidade: leadData?.quantidade || qStateValores.quantidade || technicalDetected.quantidade || null,
    especificacao: leadData?.especificacao || technicalDetected.dimensoes || null,
    ...qStateValores
  };

  // Montar instruções de campos com lógica de tentativas
  let instrucoesB2B = '=== REGRAS DE COLETA SCHEMA B2B ===\n';
  const camposFaltantesObrigatorios: string[] = [];

  schemaB2BFields.forEach(field => {
    const valorAtual = dadosCadastrados[field.key];
    const preenchido = valorAtual !== null && valorAtual !== undefined && valorAtual !== '';
    const tentativas = b2bAttempts[field.key] || 0;

    if (preenchido) {
      instrucoesB2B += `- [PREENCHIDO] ${field.label}: "${valorAtual}" (NUNCA pergunte novamente).\n`;
    } else if (field.obrigatorio) {
      camposFaltantesObrigatorios.push(field.label);
      instrucoesB2B += `- [OBRIGATÓRIO PENDENTE] ${field.label}: É OBRIGATÓRIO. A qualificação NÃO pode ser concluída sem este dado.\n`;
    } else {
      // Campo opcional
      if (tentativas >= field.max_tentativas) {
        instrucoesB2B += `- [OPCIONAL DESISTIDO] ${field.label}: Já atingiu o limite de ${field.max_tentativas} tentativas. NÃO pergunte nem insista mais.\n`;
      } else if (tentativas === 0) {
        instrucoesB2B += `- [OPCIONAL - TENTATIVA 1] ${field.label}: Tente coletar usando argumento de BENEFÍCIO COMERCIAL (ex: "Para consultar se temos faturamento a prazo ou tabela com desconto para pessoa jurídica, qual o CNPJ?").\n`;
      } else {
        instrucoesB2B += `- [OPCIONAL - TENTATIVA 2] ${field.label}: Tente em momento posterior usando argumento FORMAL DE PROPOSTA (ex: "Para o consultor anexar seus dados na ficha da cotação, você teria o CNPJ ou e-mail corporativo?"). Se o cliente recusar, siga em frente sem travar.\n`;
      }
    }
  });

  // Contexto de anúncio / página navegada (se disponível)
  let contextoAnuncio = '';
  if (leadData?.context_source || leadData?.context_interest) {
    contextoAnuncio = `\n=== CONTEXTO DE ORIGEM / NAVEGAÇÃO DO LEAD ===
Origem: ${leadData.context_source || 'Site'}
Interesse/Página: ${leadData.context_interest || 'Catálogo Geral'}
(Use esse contexto para demonstrar empatia e entender a busca do cliente sem repetir perguntas óbvias).\n`;
  }

  const masterPrompt = config?.master_prompt || 'Você é o Lino, atendente SDR comercial B2B da Permetal e Metalgrade.';

  const systemInstructions = `${masterPrompt}

${contextoAnuncio}

${catalogoEcommerceContexto}

${instrucoesB2B}

=== REGRAS DE DIÁLOGO ===
1. Mantenha tom cordial, consultivo e objetivo para WhatsApp.
2. Faça no máximo 1 a 2 perguntas curtas por mensagem.
3. Se o cliente enviou especificações ou imagem com medidas (ex: AxB 20x50mm, Inox, 400x500mm), confira no catálogo acima, valide e confirme com o cliente.
4. Quando todos os campos OBRIGATÓRIOS estiverem preenchidos (e os opcionais tentados ou preenchidos), conclua a qualificação com uma confirmação cordial e marque "qualificacao_concluida": true.

=== FORMATO OBRIGATÓRIO DE RESPOSTA ===
Responda EXCLUSIVAMENTE em formato JSON com a estrutura:
{
  "resposta_whatsapp": "Texto da sua mensagem para o cliente no WhatsApp",
  "intent": "produto_comercial | pedido_orcamento | duvida_tecnica | outro_setor",
  "acao_executada": "qualificar | roteamento_vendedor",
  "cliente": {
    "nome": "Nome identificado ou null",
    "empresa": "Nome da empresa ou null",
    "cnpj": "CNPJ identificado ou null",
    "email": "E-mail identificado ou null"
  },
  "demanda": {
    "produto_normalizado": "Nome do produto ou null",
    "quantidade_metragem": "Quantidade ou null",
    "material": "Material identificado ou null",
    "acabamento": "Acabamento ou null",
    "dimensoes": "Dimensões ou null"
  },
  "campos_opcionais_perguntados": ["cnpj" ou "email" caso tenha feito a tentativa nesta mensagem],
  "qualificacao_concluida": ${camposFaltantesObrigatorios.length === 0 ? 'true ou false' : 'false'}
}`;

  // 5. Histórico da conversa
  const messagesPayload: any[] = [
    { role: 'system', content: systemInstructions }
  ];

  history.forEach((m) => {
    messagesPayload.push({
      role: m.sender_type === 'lead' || m.sender_type === 'user' ? 'user' : 'assistant',
      content: m.message_content
    });
  });

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: messagesPayload,
      temperature: 0.2
    });

    const rawResponse = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(rawResponse);

    // Atualizar tentativas se foram perguntadas
    const novosTentativas = { ...b2bAttempts };
    if (Array.isArray(parsed.campos_opcionais_perguntados)) {
      parsed.campos_opcionais_perguntados.forEach((k: string) => {
        if (novosTentativas[k] !== undefined) {
          novosTentativas[k] = (novosTentativas[k] || 0) + 1;
        }
      });
    }

    return {
      resposta_whatsapp: parsed.resposta_whatsapp || 'Olá! Como posso te ajudar com nossos produtos?',
      intent: parsed.intent || 'produto_comercial',
      acao_executada: parsed.acao_executada || 'qualificar',
      cliente: parsed.cliente || {},
      demanda: parsed.demanda || {},
      b2b_attempts: novosTentativas,
      qualificacao_concluida: !!parsed.qualificacao_concluida && camposFaltantesObrigatorios.length === 0,
      observacoes: 'Processado com motor facetado e regras dinâmicas de Schema B2B.'
    };
  } catch (error: any) {
    console.error('[OpenAI SDR Error]', error);
    return {
      erro_openai: error.message,
      resposta_whatsapp: 'Olá! Recebi sua mensagem e nossa equipe comercial já vai te atender.'
    };
  }
}

/**
 * generateSupportResponse — Gera resposta acolhedora enquanto o vendedor não atende e notifica SLA
 */
export async function generateSupportResponse(
  leadOrMessage: any,
  history: any[] = [],
  modeOrSeller?: string
) {
  const { data: config } = await supabase.from('tenant_config').select('openai_key, support_prompt').limit(1).single();
  const apiKey = config?.openai_key || process.env.OPENAI_API_KEY;

  const defaultRet = {
    resposta: 'Olá! O consultor responsável já foi notificado da sua mensagem e logo entrará em contato.',
    message: 'Olá! O consultor responsável já foi notificado da sua mensagem e logo entrará em contato.',
    numero_pedido: null,
    escalar_urgente: true,
    intencao_pos_venda: 'atendimento',
    nova_informacao: null
  };

  if (!apiKey || apiKey === 'fake-key') {
    return defaultRet;
  }

  const openai = new OpenAI({ apiKey });
  const sellerName = typeof leadOrMessage === 'object' ? leadOrMessage?.current_owner?.name : modeOrSeller;
  const supportPrompt = config?.support_prompt || `Você é o Lino Suporte da Permetal. O cliente já foi qualificado e está aguardando o consultor ${sellerName || 'responsável'}.
Seja cordial, seguro e acolhedor. Informe que nossa equipe já está com a solicitação em tela e acionamos o consultor para dar prioridade. Mantenha a resposta curta (1 a 2 frases).`;

  try {
    const formattedHistory = (history || []).map((m: any) => ({
      role: m.sender_type === 'lead' || m.sender_type === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.message_content || ''
    }));

    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: supportPrompt },
        ...formattedHistory
      ],
      temperature: 0.3
    });
    const text = res.choices[0]?.message?.content || defaultRet.resposta;
    return {
      resposta: text,
      message: text,
      numero_pedido: null,
      escalar_urgente: true,
      intencao_pos_venda: 'atendimento',
      nova_informacao: null
    };
  } catch (e: any) {
    return defaultRet;
  }
}
