const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    env[match[1]] = (match[2] || '').trim().replace(/^"|"$/g, '');
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  // Testar se a coluna existe tentando ler
  const { data, error } = await supabase.from('leads').select('tentativas_coleta').limit(1);
  if (error && error.code === 'PGRST204') {
    console.log('Coluna tentativas_coleta NÃO existe. Precisa criar no Supabase Dashboard.');
    console.log('SQL a executar no Supabase SQL Editor:');
    console.log('ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tentativas_coleta INT DEFAULT 0;');
  } else if (error) {
    console.log('Erro:', error);
  } else {
    console.log('Coluna tentativas_coleta JÁ EXISTE ✅');
  }
}

run();
