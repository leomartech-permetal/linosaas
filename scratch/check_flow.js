const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('fs');

// Carregar .env.local manualmente
const envPath = 'c:/Users/MARKETING1/Documents/Projeto_Lino/lino-crm/.env.local';
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  console.log('--- DIAGNÓSTICO DE FLUXO ---');

  // 1. Verificar Buffer
  const { data: buffer } = await supabase
    .from('conversation_buffers')
    .select('*, leads(whatsapp_number)')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('\nÚLTIMAS MENSAGENS NO BUFFER:');
  console.table(buffer?.map(b => ({
    Data: b.created_at,
    Número: b.leads?.whatsapp_number,
    Conteudo: b.content?.substring(0, 30),
    Processado: b.processed
  })));

  // 2. Verificar Interações
  const { data: interactions } = await supabase
    .from('interactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\nÚLTIMAS INTERAÇÕES SALVAS:');
  console.table(interactions?.map(i => ({
    Data: i.created_at,
    Tipo: i.sender_type,
    Conteudo: i.message_content?.substring(0, 30)
  })));
}

check();
