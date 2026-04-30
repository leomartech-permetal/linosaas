const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const query = `
    ALTER TABLE public.tenant_config ADD COLUMN IF NOT EXISTS bot_active BOOLEAN DEFAULT true;
  `;
  const { error } = await supabase.rpc('exec_sql', { sql_string: query });
  if (error) {
    console.error('Falha via RPC:', error.message);
    console.log('Você precisa rodar a query manualmente no painel do Supabase:');
    console.log(query);
  } else {
    console.log('Coluna bot_active adicionada!');
  }
}

run();
