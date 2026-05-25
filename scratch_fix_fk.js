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
  const sql = `
    ALTER TABLE public.leads
    DROP CONSTRAINT IF EXISTS leads_current_owner_id_fkey;

    ALTER TABLE public.leads
    ADD CONSTRAINT leads_current_owner_id_fkey
    FOREIGN KEY (current_owner_id)
    REFERENCES public.admin_users (id)
    ON DELETE SET NULL;
  `;
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log('RPC execution:', error || data);
}

run();
