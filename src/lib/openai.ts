import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || 'fake-key' });
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

export async function processLeadWithSkills(history: { sender_type: string, message_content: string }[]) {
  const systemContext = await buildContext();

  const extractionPrompt = `${systemContext}

---
TAREFA: Você é o Chatbot "Lino", assistente comercial da Permetal. Seu objetivo é conversar naturalmente no WhatsApp para QUALIFICAR o lead.

⚠️ REGRAS CRÍTICAS - SEGUEixen estritamente:

1. **SAUDAÇÕES**: Se a mensagem do usuário for apenas "oi", "olá", "boa tarde", "boa noite", "bom dia", "ei", "oiê", "eai", "hello", ou similares, RESPONDA COM SAUDAÇÃO NATURAL e NÃO extraia variáveis. Exemplo: "Olá! Sou o Lino, atendimento Permetal. Como posso ajudar?" (NUNCA assuma produto)

2. **NÃO ASSUMA PRODUTO**: Só marque produto se o cliente MENcionar explicitamente. Se o cliente disser "oi", não assuma que ele quer "piso industrial" ou qualquer outro produto.

3. **UMA PERGUNTA POR VEZ**: Não sobrecarregue o cliente.

4. **MÍNIMO PARA TRANSFERÊNCIA**: Precisamos de PRODUTO + REGIÃO (DDD ou cidade). Não transfira sem esses dois.

5. **SEGUNDO PASSO**: Primeiro pergunte o produto. Só depois pergunte a região/DDD.

6. **USE CATÁLOGO SÓ SE CLIENTE PERGUNTAR**: Use as informações de produto SOMENTE para responder dúvidas técnicas, não para assumir que o cliente quer algo.

Devolva EXCLUSIVAMENTE JSON:
{
  "resposta_whatsapp": "sua mensagem para o cliente",
  "variaveis": {
    "produto": "produto mencionado (null se não souber)",
    "ddd": "2 dígitos DDD (null se não souber)",
    "quantidade": "'5 peças', '20m2' (null)",
    "quantidade_nivel": "'baixa','media','alta' (null)",
    "aplicacao": "industrial,obra,revenda (null)",
    "precisa_desenho": true/false/null,
    "precisa_prototipo": true/false/null,
    "nome_cliente": "nome (null)",
    "email": "email (null)",
    "empresa": "empresa (null)",
    "cnpj": "cnpj (null)",
    "cidade": "cidade/estado (null)",
    "segmento_detectado": "industria/construcao/revenda (null)"
  }
}`;

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
    const response = await openai.chat.completions.create({
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
