import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function buildContext(): Promise<string> {
  const { data: config } = await supabase.from('tenant_config').select('master_prompt').limit(1).single();
  let context = config?.master_prompt || 'Você é Lino, um assistente SDR comercial focado em qualificar leads e prepará-los para o atendimento com um vendedor humano.';

  const { data: skills } = await supabase.from('skills').select('*').eq('active', true);
  if (skills && skills.length > 0) {
    context += '\n\n=== HABILIDADES ATIVAS ===';
    for (const skill of skills) {
      context += `\n\n### ${skill.name} (${skill.type})\n${(skill.prompt || '').substring(0, 10000)}`;
      const { data: links } = await supabase.from('skill_rag_links').select('rag_document_id').eq('skill_id', skill.id);
      if (links && links.length > 0) {
        const ragIds = links.map(l => l.rag_document_id);
        const { data: ragDocs } = await supabase.from('rag_documents').select('name, content').in('id', ragIds).eq('active', true);
        if (ragDocs && ragDocs.length > 0) {
          context += '\n📚 Base de Conhecimento:';
          for (const doc of ragDocs) { context += `\n--- ${doc.name} ---\n${doc.content?.substring(0, 8000) || ''}`; }
        }
      }
    }
  }

  // Adicionar produtos cadastrados para a IA reconhecer
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

  const dynamicOpenai = new OpenAI({ apiKey });
  const systemContext = await buildContext();

  const extractionPrompt = `${systemContext}

---
INSTRUÇÃO FINAL E FORMATO DE SAÍDA OBRIGATÓRIO:
Você deve devolver EXCLUSIVAMENTE um JSON válido com a seguinte estrutura. 

REGRAS CRÍTICAS DE QUALIFICAÇÃO:
1. NÃO EXECUTE a ação de "roteamento" ou "transferir" se não tiver coletado o NOME e a EMPRESA/CNPJ do cliente.
2. Se o cliente pedir para falar com um humano prematuramente, responda: "Com certeza! Para que o especialista já te atenda com os preços e prazos prontos, me informe apenas seu Nome e Empresa/CNPJ, por favor."
3. Seja um consultor técnico, não apenas um coletor de dados. Mostre conhecimento sobre os produtos da Permetal.

{
  "resposta_whatsapp": "sua mensagem para o cliente",
  "skill_usada": "nome_da_skill_que_gerou_a_resposta",
  "intent": "",
  "confidence": "",
  "cliente": {
    "nome": "",
    "empresa": "",
    "cnpj": "",
    "email": "",
    "telefone": "",
    "ddd_regiao": "",
    "canal_origem": ""
  },
  "demanda": {
    "produto_familia": "",
    "produto_modelo": "",
    "marca_linha": "",
    "segmento_aplicacao": "",
    "quantidade_metragem": "",
    "material": "",
    "acabamento": "",
    "dimensoes": "",
    "tem_projeto_anexo": "",
    "urgencia": ""
  },
  "rag": {
    "consultado": false,
    "fontes": [],
    "confianca": "",
    "observacao": ""
  },
  "acao_executada": "",
  "observacoes": ""
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
      model: 'gpt-4o-mini',
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
  
  const systemPrompt = `Você é o Lino Suporte, assistente da Permetal S.A. Sua função é tranquilizar o cliente de forma HUMANA enquanto o vendedor não chega.
  
  CONTEXTO ATUAL:
  - Lead: ${leadData.name || 'Cliente'}
  - Vendedor: ${leadData.vendedor_nome || 'um especialista'}
  - Situação: ${actionType}
  
  REGRAS DE OURO:
  1. NÃO SEJA UM PAPAGAIO. Não use frases como "Entendo sua urgência" ou "Vou verificar".
  2. ANALISE O HISTÓRICO: Se o cliente estiver bravo, peça desculpas sinceras e explique que o time de vendas está com alta demanda, mas que você (Lino) está aqui para ajudar com dúvidas técnicas básicas se precisar.
  3. Seja curto e direto. Máximo 2 frases.
  4. Use o nome do vendedor (${leadData.vendedor_nome}) para mostrar que você sabe quem deveria estar atendendo.
  
  SAÍDA: Retorne apenas o texto da mensagem para o WhatsApp.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map(m => ({ 
      role: m.sender_type === 'lead' ? 'user' : 'assistant', 
      content: m.message_content 
    }))
  ];

  try {
    const response = await dynamicOpenai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages as any,
      max_tokens: 200
    });
    return { message: response.choices[0].message.content || "Estou acompanhando seu caso." };
  } catch (e) {
    return { message: "Um momento, estou verificando com o vendedor." };
  }
}
