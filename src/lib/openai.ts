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
TAREFA: Você é o Chatbot "Lino". O seu objetivo é conversar com o cliente no WhatsApp de forma natural, educada e direta, com o objetivo de EXTRAIR VARIÁVEIS de qualificação.

INSTRUÇÕES DO DIÁLOGO:
1. Responda à última mensagem do usuário na chave "resposta_whatsapp" no JSON.
2. Seja objetivo. Faça APENAS UMA pergunta de cada vez para não sobrecarregar o cliente.
3. Não fale que você está "extraindo variáveis" nem nada técnico. Aja como um atendente humano real do WhatsApp.
4. O mínimo que precisamos saber para transferir o lead é: Qual o PRODUTO e qual a REGIÃO (ou DDD). 
5. Se não souber o DDD, pergunte de qual cidade/estado a pessoa está falando.
6. Atualize o objeto "variaveis" com tudo que já foi descoberto na conversa inteira.

Devolva **EXCLUSIVAMENTE** um objeto JSON no formato abaixo. Não adicione nenhum texto extra fora do JSON.

FORMATO OBRIGATÓRIO (JSON):
{
  "resposta_whatsapp": "A mensagem de texto que você enviará para o cliente agora",
  "variaveis": {
    "produto": "nome do produto identificado (ou null se não souber)",
    "ddd": "2 dígitos do DDD (ou null se não souber)",
    "quantidade": "texto livre: '5 peças', '20m2' (ou null)",
    "quantidade_nivel": "'baixa', 'media', 'alta' (ou null)",
    "aplicacao": "uso do produto: industrial, obra, revenda etc (ou null)",
    "precisa_desenho": true/false (ou null),
    "precisa_prototipo": true/false (ou null),
    "nome_cliente": "nome se mencionado (ou null)",
    "email": "email se mencionado (ou null)",
    "empresa": "empresa se mencionado (ou null)",
    "cnpj": "cnpj se mencionado (ou null)",
    "cidade": "cidade/estado se mencionado (ou null)",
    "segmento_detectado": "industria/construcao/revenda/belinox/antiofuscante (ou null)"
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
