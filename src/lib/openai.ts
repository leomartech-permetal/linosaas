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
IMPORTANTE: Não ofereça o roteamento ou transferência para o especialista ANTES de ter coletado os dados básicos de cadastro (Nome, Empresa, CNPJ ou E-mail), a menos que o cliente se recuse explicitamente.

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
