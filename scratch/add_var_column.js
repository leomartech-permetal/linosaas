require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const defaultVars = [
  { name: 'empresa', description: 'Nome da empresa do cliente', required: true },
  { name: 'email', description: 'E-mail corporativo', required: false }
];

async function run() {
  // O Supabase JS client não tem um método DDL direto sem RPC ou postgres.
  // Como alternativa simples, como não sabemos se o RPC run_sql existe,
  // vamos tentar ler a coluna primeiro, se der erro, vamos instruir a criá-la 
  // via query SQL no Dashboard do Supabase, MAS espere, a migration 
  // pode ser feita por uma API direta de POST no rest, ou via supabase cli.
  
  // Vamos primeiro tentar ver se a coluna existe lendo
  const { data, error } = await supabase.from('tenant_config').select('extraction_variables').limit(1);
  if (error && error.code === 'PGRST204') {
    console.log("Column does not exist. We need to create it.");
    // Tentativa via RPC
    const rpcRes = await supabase.rpc('run_sql', { query: 'ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS extraction_variables JSONB DEFAULT \'[]\';' });
    console.log("RPC result:", rpcRes);
  } else {
    console.log("Column already exists or can be read:", data);
  }
}
run();
