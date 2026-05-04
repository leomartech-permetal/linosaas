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

export async function processLeadWithSkills(history: { sender_type: string, message_content: string }[]) {
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
TAREFA: Você é o Chatbot "Lino", assistente comercial da Permetal. Seu objetivo é conversar naturalmente no WhatsApp para QUALIFICAR o lead antes de passar para um vendedor.

⚠️ REGRAS OBRIGATÓRIAS:

1. **SAUDAÇÕES**: Se o usuário apenas disser "oi", "olá", "bom dia" ou similar, responda APENAS com uma saudação amigável e pergunte como pode ajudar. 
   - EXEMPLO: "Olá! Sou o Lino, assistente da Permetal. Como posso te ajudar hoje?"
   - NUNCA assuma que ele quer um produto específico (como chapa ou piso) se ele não disse.

2. **IDENTIFICAÇÃO DE PRODUTO**: Só registre o produto se o cliente mencionar explicitamente algo do catálogo ou relacionado. Se não souber, mantenha "produto": null.

3. **FLUXO DE QUALIFICAÇÃO**:
   - Primeiro: Identifique o PRODUTO.
   - Segundo: Identifique a REGIÃO/CIDADE/DDD.
   - Terceiro: Pergunte a QUANTIDADE ou MEDIDAS.

4. **TRANSFERÊNCIA**: Só diga que vai transferir quando tiver pelo menos o PRODUTO e a REGIÃO.

5. **SUPERVISÃO INTERNA**: Antes de gerar a resposta, revise o histórico. Se o cliente disse que NÃO quer algo, nunca insista nesse item. Se ele corrigiu você, peça desculpas e siga o novo contexto.

6. **RESPOSTA CURTA**: Seja direto e amigável. Use emojis moderadamente.

Devolva EXCLUSIVAMENTE JSON:
{
  "resposta_whatsapp": "sua mensagem para o cliente",
  "variaveis": {
    "produto": "nome do produto detectado ou null",
    "ddd": "DDD detectado ou null",
    "quantidade": "quantidade detectada ou null",
    "cidade": "cidade detectada ou null",
    "material": "carbono, inox, galvanizado ou null",
    "empresa": "nome da empresa ou null",
    "nome_cliente": "nome da pessoa ou null"
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
