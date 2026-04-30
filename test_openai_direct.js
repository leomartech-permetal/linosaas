require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function processLeadWithSkills(history) {
  const { data: config } = await supabase.from('tenant_config').select('master_prompt').limit(1).single();
  const { data: skills } = await supabase.from('skills').select('*').eq('active', true);
  const { data: products } = await supabase.from('products').select('name, synonyms');

  let context = config?.master_prompt || 'Você é o Lino, um assistente virtual de vendas (SDR).';
  context += '\n\n=== HABILIDADES ATIVAS ===';
  if (skills) {
    for (const skill of skills) {
      context += `\n\n### ${skill.name}\n${(skill.prompt || '').substring(0, 10000)}`;
    }
  }

  const messages = [
    { role: 'system', content: context },
    ...history.map(h => ({
      role: h.sender_type === 'lead' ? 'user' : 'assistant',
      content: h.message_content
    }))
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: messages,
    response_format: { type: 'json_object' }
  });

  return JSON.parse(response.choices[0].message.content);
}

async function run() {
  try {
    const res = await processLeadWithSkills([{ sender_type: 'lead', message_content: 'Oi' }]);
    console.log('IA Funcionando:', res);
  } catch (e) {
    console.error('IA Falhou:', e.message);
  }
}

run();
