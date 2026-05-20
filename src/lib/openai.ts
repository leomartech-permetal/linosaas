import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

/**
 * buildContext — Inteligente e Seletivo
 * 
 * Quando `detectedProduct` é passado:
 *   → carrega APENAS a skill vinculada àquele produto + seu RAG específico
 *   → evita conflito de instruções e overflow de tokens
 * 
 * Quando `detectedProduct` é null/undefined:
 *   → carrega skills genéricas (sem product_tag) para a fase inicial de coleta
 */
async function buildContext(detectedProduct?: string | null): Promise<string> {
  const { data: config } = await supabase.from('tenant_config').select('master_prompt').limit(1).single();
  let context = config?.master_prompt || 'Você é Lino, um assistente SDR comercial focado em qualificar leads e prepará-los para o atendimento com um vendedor humano.';

  // --- Seleção inteligente de skills ---
  let skillQuery = supabase.from('skills').select('*').eq('active', true);

  if (detectedProduct) {
    // Produto detectado: busca skill específica do produto OU skills sem filtro de produto (genéricas)
    skillQuery = supabase
      .from('skills')
      .select('*')
      .eq('active', true)
      .or(`product_tag.ilike.%${detectedProduct}%,product_tag.is.null`);
  } else {
    // Sem produto: carrega apenas skills genéricas (sem product_tag) para não poluir o contexto
    skillQuery = supabase
      .from('skills')
      .select('*')
      .eq('active', true)
      .is('product_tag', null);
  }

  const { data: skills } = await skillQuery;

  if (skills && skills.length > 0) {
    const skillLabel = detectedProduct
      ? `=== HABILIDADES ATIVAS PARA: ${detectedProduct.toUpperCase()} ===`
      : '=== HABILIDADES GERAIS ===';
    context += `\n\n${skillLabel}`;

    for (const skill of skills) {
      context += `\n\n### ${skill.name} (${skill.type})\n${(skill.prompt || '').substring(0, 10000)}`;

      // Carrega RAG apenas da skill selecionada (não de todos os produtos)
      const { data: links } = await supabase.from('skill_rag_links').select('rag_document_id').eq('skill_id', skill.id);
      if (links && links.length > 0) {
        const ragIds = links.map(l => l.rag_document_id);
        const { data: ragDocs } = await supabase.from('rag_documents').select('name, content').in('id', ragIds).eq('active', true);
        if (ragDocs && ragDocs.length > 0) {
          context += '\n📚 Base de Conhecimento Técnica:';
          for (const doc of ragDocs) { context += `\n--- ${doc.name} ---\n${doc.content?.substring(0, 8000) || ''}`; }
        }
      }
    }
  }

  // Catálogo de produtos (sempre presente para identificação inicial)
  const { data: products } = await supabase.from('products').select('name, synonyms, is_express_eligible, express_max_qty, brands(name)');
  if (products && products.length > 0) {
    context += '\n\n=== CATÁLOGO DE PRODUTOS ===\n';
    context += 'Identifique o produto do cliente baseando-se nas opções abaixo:\n';
    for (const p of products) {
      context += `- ${p.name} | Marca: ${(p as any).brands?.name || 'N/A'} | Sinônimos: ${(p.synonyms || []).join(', ')}`;
      if (p.is_express_eligible) context += ` | EXPRESS (limite: ${p.express_max_qty})`;
      context += '\n';
    }
  }

  return context;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function processLeadWithSkills(history: { sender_type: string, message_content: string }[], leadId?: string) {
  // 1. Buscar configuração e chave
  const { data: config } = await supabase.from('tenant_config').select('*').limit(1).single();
  const apiKey = config?.openai_key || process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === 'fake-key') {
    return { erro_openai: 'Chave da OpenAI não configurada no banco de dados ou env.' };
  }

  // 2. Recuperar produto já detectado para carregar skill seletiva
  let detectedProduct: string | null = null;
  if (leadId) {
    const { data: leadData } = await supabase
      .from('leads')
      .select('detected_product')
      .eq('id', leadId)
      .single();
    detectedProduct = leadData?.detected_product || null;
  }

  const dynamicOpenai = new OpenAI({ apiKey });
  // buildContext recebe o produto detectado → carrega skill especializada
  const systemContext = await buildContext(detectedProduct);
  console.log(`[OpenAI Debug] Produto detectado: ${detectedProduct || 'nenhum (fase inicial)'}`);

  const extractionPrompt = `${systemContext}

---
INSTRUÇÃO FINAL — LEIA COM ATENÇÃO:

Você deve devolver EXCLUSIVAMENTE um JSON válido. Siga RIGOROSAMENTE as regras abaixo:

1. ACIONAMENTO DE SKILLS: Se o cliente mencionou um produto e existe uma "HABILIDADE ATIVA" para esse produto acima, OBRIGATORIAMENTE siga as perguntas técnicas dessa skill. Não pule etapas.
2. DADOS MÍNIMOS: Só marque "dados_minimos_completos": true quando tiver: produto identificado + DDD/região + pelo menos uma informação de aplicação ou quantidade.
3. ROTEAMENTO: Quando "dados_minimos_completos" for true, defina "acao_executada" como "roteamento_comercial". Isso dispara o envio ao vendedor automaticamente.
4. RESPOSTAS: Uma pergunta por vez. Tom humano, nunca revele que é IA.
5. RAG: Se há "Base de Conhecimento Técnica" acima, use-a para responder dúvidas técnicas com precisão.

{
  "pensamento_critico": "<OBRIGATÓRIO: 1. Qual o produto identificado? 2. Existe Habilidade Ativa para este produto? 3. Já coletei todas as especificações técnicas da skill? 4. Tenho produto + DDD/região para rotear?>",
  "resposta_whatsapp": "<sua mensagem para o cliente — máximo 3 frases>",
  "skill_usada": "<nome_exato_da_skill_utilizada ou SDR_GERAL se sem skill específica>",
  "intent": "<classificação da intenção: PRODUTO, VAGAS, FORNECEDOR, LOGISTICA, FINANCEIRO, COMEX, MARKETING, OUTRO>",
  "confidence": "<0 a 100>",
  "cliente": {
    "nome": "<extraia o nome ou null>",
    "empresa": "<extraia a empresa ou null>",
    "cnpj": "<extraia o cnpj ou null>",
    "email": "<extraia o email ou null>",
    "telefone": "<extraia o telefone ou null>",
    "ddd_regiao": "<extraia o ddd de 2 dígitos ou null>",
    "canal_origem": "whatsapp"
  },
  "demanda": {
    "produto_normalizado": "<nome exato do produto conforme catálogo ou null>",
    "produto_familia": "<produto principal ou null>",
    "produto_modelo": "<modelo específico ou null>",
    "marca_linha": "<marca ou null>",
    "segmento_normalizado": "<industria, construcao ou revenda ou null>",
    "segmento_aplicacao": "<aplicação descrita pelo cliente ou null>",
    "quantidade_metragem": "<quantidade ou null>",
    "material": "<material ou null>",
    "acabamento": "<acabamento ou null>",
    "dimensoes": "<dimensões ou null>",
    "tem_projeto_anexo": false,
    "urgencia": "<alta, media, baixa ou null>"
  },
  "estado_lead": {
    "dados_minimos_completos": <true APENAS se: produto identificado + ddd_regiao coletado + pelo menos aplicacao ou quantidade informados. Caso contrário: false>,
    "motivo_faltante": "<o que ainda falta, ex: faltando_ddd, faltando_aplicacao, faltando_especificacao_tecnica ou null se completo>"
  },
  "rag": {
    "consultado": <true se usou a Base de Conhecimento Técnica, false caso contrário>,
    "fontes": ["<nome do documento RAG usado>"],
    "confianca": "<alta, media ou baixa>",
    "observacao": "<nota sobre o que o RAG respondeu>"
  },
  "acao_executada": "<roteamento_comercial se dados_minimos_completos=true, coleta_dados se ainda coletando, duvida_tecnica se respondeu pergunta técnica, outro_setor se não é cliente de produto>",
  "observacoes": "<notas internas do raciocínio>"
}
`;

  const messages: ChatMessage[] = [
    { role: 'system', content: extractionPrompt }
  ];

  // Adiciona o histórico
  for (const msg of history) {
    if (msg.sender_type === 'lead') {
      messages.push({ role: 'user', content: msg.message_content });
    } else if (msg.sender_type === 'sdr_ai') {
      messages.push({ role: 'assistant', content: msg.message_content });
    }
  }

  console.log(`[OpenAI Debug] System Context Length: ${systemContext.length} caracteres`);
  console.log(`[OpenAI Debug] Mensagens: ${messages.length}`);

  try {
    console.log(`[OpenAI] Enviando requisição com ${messages.length} mensagens.`);
    const response = await dynamicOpenai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as any,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content || '{}';
    console.log('[OpenAI] Resposta bruta:', content);
    const result = JSON.parse(content);
    return result;
  } catch (error: any) {
    console.error('[OpenAI Error]', error.message || error);
    return { erro_openai: error.message || 'Erro desconhecido na OpenAI' };
  }
}

export async function generateSupportResponse(leadData: any, history: any[], actionType: string) {
  const { data: config } = await supabase.from('tenant_config').select('*').limit(1).single();
  const apiKey = config?.openai_key || process.env.OPENAI_API_KEY;
  if (!apiKey) return { message: "Estou verificando sua situação com nossa equipe." };

  const dynamicOpenai = new OpenAI({ apiKey });

  // Buscar nome real do vendedor no banco
  let vendedorNome = 'o especialista';
  if (leadData.current_owner_id) {
    const { data: seller } = await supabase
      .from('admin_users')
      .select('name')
      .eq('id', leadData.current_owner_id)
      .single();
    if (seller?.name) vendedorNome = seller.name;
  }

  // Prompt separado de Suporte (lê do campo support_prompt da config, ou usa padrão)
  const supportPromptBase = config?.support_prompt || `Você é o Lino Suporte, assistente da Permetal S.A.
Você atua como ponte entre o cliente e o vendedor responsável pelo atendimento.
Tom: humano, empático, direto. Máximo 2 frases por mensagem.`;

  const systemPrompt = `${supportPromptBase}

CONTEXTO DO ATENDIMENTO ATUAL:
- Cliente: ${leadData.name || 'Cliente'}
- Vendedor responsável: ${vendedorNome}
- Situação: ${actionType}

REGRAS OBRIGATÓRIAS:
1. Nunca diga que não sabe quem é o vendedor — o vendedor é ${vendedorNome}.
2. Nunca use frases prontas como "Entendo sua urgência" ou "Vou verificar".
3. Se o cliente estiver bravo, reconheça o problema sem inventar justificativas.
4. Nunca diga "alta demanda" sem ter certeza do contexto real.
5. Não prometa prazos específicos.

SAÍDA: Apenas o texto da mensagem para o WhatsApp.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map(m => ({
      role: m.sender_type === 'lead' ? 'user' : 'assistant',
      content: m.message_content
    }))
  ];

  try {
    const response = await dynamicOpenai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as any,
      max_tokens: 200
    });
    return { message: response.choices[0].message.content || "Estou acompanhando seu caso." };
  } catch (e) {
    return { message: "Um momento, estou verificando com o vendedor." };
  }
}

