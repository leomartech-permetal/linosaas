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

async function checkLog() {
  const { data: log } = await supabase.from('debug_logs').select('*').eq('id', '86db35b1-b94a-4151-8b57-f413c0f3f242').single();
  console.log('--- LOG DE ROTEAMENTO (DEBUG_LOGS) ---');
  console.log(JSON.stringify(log, null, 2));
}

checkLog();
