import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * processLeadWithSkills — Motor central simplificado do SDR Lino
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
  let schemaB2B: { obrigatorias: string[]; opcionais: any[] } = {
    obrigatorias: ['nome_cliente', 'empresa', 'email', 'quantidade'],
    opcionais: []
  };

  if (leadId) {
    const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();
    if (lead) {
      leadData = lead;
      detectedProduct = lead.detected_product || lead.produto || null;

      // Buscar schema do produto
      if (detectedProduct) {
        const { data: prod } = await supabase
          .from('products')
          .select('qualification_schema')
          .ilike('name', `%${detectedProduct}%`)
          .limit(1)
          .maybeSingle();

        if (prod?.qualification_schema) {
          schemaB2B = prod.qualification_schema;
        }
      }
    }
  }

  // 3. Buscar catálogo e opções reais (sem alucinações de RAG)
  let catalogoContexto = '';
  const { data: products } = await supabase.from('products').select('name, synonyms, brands(name)');
  if (products && products.length > 0) {
    catalogoContexto += '\n=== CATÁLOGO DE PRODUTOS DISPONÍVEIS ===\n';
    products.forEach((p: any) => {
      catalogoContexto += `- ${p.name} (Marca: ${p.brands?.name || 'Permetal'}) | Sinônimos: ${(p.synonyms || []).join(', ')}\n`;
    });
  }

  // Buscar opções técnicas do produto ou termo mencionado
  let opcoesTecnicasRAG = '';
  const ultimaMsg = history[history.length - 1]?.message_content || '';
  const termoBusca = detectedProduct || ultimaMsg;

  if (termoBusca && termoBusca.length > 2) {
    // 1. Busca por chunks estruturados
    const { data: chunks } = await supabase
      .from('rag_chunks')
      .select('content, metadata')
      .ilike('content', `%${detectedProduct || 'brise'}%`)
      .limit(15);

    if (chunks && chunks.length > 0) {
      opcoesTecnicasRAG += '\n=== OPÇÕES REAIS NO CATÁLOGO TÉCNICO ===\n';
      chunks.forEach((c: any) => {
        opcoesTecnicasRAG += `- ${c.content}\n`;
      });
    }

    // 2. Busca por documentos de catálogo anexados (ex: Sucroenergética, Chapas, etc.)
    const { data: ragDocs } = await supabase
      .from('rag_documents')
      .select('name, content')
      .eq('active', true)
      .limit(3);

    if (ragDocs && ragDocs.length > 0) {
      opcoesTecnicasRAG += '\n=== INFORMAÇÕES TÉCNICAS ADICIONAIS ===\n';
      ragDocs.forEach((d: any) => {
        opcoesTecnicasRAG += `[${d.name}]: ${(d.content || '').substring(0, 1500)}\n`;
      });
    }
  }

  // 4. Montar contexto de Sistema
  const masterPrompt = config?.master_prompt || 'Você é o Lino, atendente SDR comercial B2B da Permetal e Metalgrade.';

  const qStateValores = leadData?.qualification_state?.valores || {};
  const dadosCadastrados: Record<string, any> = {
    nome_cliente: leadData?.name || qStateValores.nome_cliente || null,
    empresa: leadData?.company || qStateValores.empresa || null,
    cnpj: leadData?.cnpj || qStateValores.cnpj || null,
    email: leadData?.email_corporativo || qStateValores.email || null,
    produto: detectedProduct || qStateValores.produto || null,
    quantidade: leadData?.quantidade || qStateValores.quantidade || null,
    ...qStateValores
  };

  const dadosFormatados = Object.entries(dadosCadastrados)
    .map(([k, v]) => `- ${k.toUpperCase()}: ${v || 'Pendente'}`)
    .join('\n');

  const systemInstructions = `${masterPrompt}

${catalogoContexto}

${opcoesTecnicasRAG}

=== ESTADO ATUAL DO LEAD ===
${dadosFormatados}

=== REGRAS DE QUALIFICAÇÃO (SCHEMA B2B) ===
- Campos OBRIGATÓRIOS para concluir qualificação: ${schemaB2B.obrigatorias.join(', ')}
- IMPORTANTE: NUNCA pergunte novamente campos que já estejam cadastrados.
- Ao apresentar opções técnicas (ex: materiais, modelos), apresente TODAS as opções reais que constam nas informações técnicas acima.
- Se o cliente perguntar "quais são os outros materiais?", responda com a lista completa do catálogo (ex: Aço Carbono, Aço Galvanizado, Alumínio, Inox, etc.).
- Faça perguntas curtas e diretas (máximo 1 a 2 perguntas por mensagem).
- Quando TODOS os campos obrigatórios estiverem preenchidos, faça uma breve confirmação e marque "qualificacao_concluida": true.

=== FORMATO OBRIGATÓRIO DE RESPOSTA ===
Responda EXCLUSIVAMENTE em formato JSON com a estrutura:
{
  "resposta_whatsapp": "Texto da sua mensagem cordial e objetiva para o cliente no WhatsApp",
  "intent": "produto_comercial | pedido_orcamento | duvida_tecnica | outro_setor",
  "acao_executada": "qualificar | roteamento_vendedor",
  "cliente": {
    "nome": "Nome identificado ou null",
    "empresa": "Nome da empresa ou null",
    "cnpj": "CNPJ ou null",
    "email": "E-mail corporativo ou null"
  },
  "demanda": {
    "produto_normalizado": "Nome do produto padronizado ou null",
    "quantidade_metragem": "Quantidade ou metragem ou null",
    "material": "Material especificado ou null",
    "acabamento": "Acabamento ou null",
    "dimensoes": "Dimensões ou medidas ou null"
  },
  "qualificacao_concluida": false
}`;

  // 5. Histórico da conversa formatado
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

    return {
      resposta_whatsapp: parsed.resposta_whatsapp || 'Olá! Como posso te ajudar com nossos produtos?',
      intent: parsed.intent || 'produto_comercial',
      acao_executada: parsed.acao_executada || 'qualificar',
      cliente: parsed.cliente || {},
      demanda: parsed.demanda || {},
      qualificacao_concluida: !!parsed.qualificacao_concluida,
      observacoes: 'Processado com sucesso pelo novo motor simplificado.'
    };
  } catch (error: any) {
    console.error('[OpenAI SDR Error]', error);
    return {
      erro_openai: error.message,
      resposta_whatsapp: 'Olá! Recebi sua mensagem e nosso time comercial já vai te atender.'
    };
  }
}

/**
 * generateSupportResponse — Gera resposta amigável enquanto o vendedor não atende
 */
export async function generateSupportResponse(
  leadOrMessage: any,
  history: any[] = [],
  modeOrSeller?: string
) {
  const { data: config } = await supabase.from('tenant_config').select('openai_key, support_prompt').limit(1).single();
  const apiKey = config?.openai_key || process.env.OPENAI_API_KEY;

  const defaultRet = {
    resposta: 'Olá! O vendedor responsável já foi notificado e logo entrará em contato.',
    message: 'Olá! O vendedor responsável já foi notificado e logo entrará em contato.',
    numero_pedido: null,
    escalar_urgente: false,
    intencao_pos_venda: 'atendimento',
    nova_informacao: null
  };

  if (!apiKey || apiKey === 'fake-key') {
    return defaultRet;
  }

  const openai = new OpenAI({ apiKey });
  const sellerName = typeof leadOrMessage === 'object' ? leadOrMessage?.current_owner?.name : modeOrSeller;
  const supportPrompt = config?.support_prompt || `Você é o Lino Suporte. O cliente está aguardando o vendedor ${sellerName || 'responsável'}. Seja cordial, acolhedor e informe que a equipe já foi acionada para dar continuidade.`;

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
    const text = res.choices[0]?.message?.content || 'O vendedor responsável já está a par e logo responderá.';
    return {
      resposta: text,
      message: text,
      numero_pedido: null,
      escalar_urgente: false,
      intencao_pos_venda: 'atendimento',
      nova_informacao: null
    };
  } catch (e: any) {
    return defaultRet;
  }
}


