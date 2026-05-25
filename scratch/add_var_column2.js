const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
let supabaseUrl = '';
let supabaseKey = '';
env.split('\n').forEach(line => {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('tenant_config').select('extraction_variables').limit(1);
  if (error && error.code === 'PGRST204') {
    console.log("Creating column...");
    const rpcRes = await supabase.rpc('run_sql', { query: 'ALTER TABLE tenant_config ADD COLUMN IF NOT EXISTS extraction_variables JSONB DEFAULT \'[]\';' });
    console.log("RPC result:", rpcRes);
  } else {
    console.log("Column exists:", data);
  }
}
run();
