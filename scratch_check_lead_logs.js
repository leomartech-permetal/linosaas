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
  const leadId = '3e341a78-d0a0-4988-b11b-cd39c9cc7db1';
  
  const { data: logs } = await supabase
    .from('debug_logs')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true });

  console.log('--- DEBUG LOGS ---');
  logs.forEach(l => {
    console.log(`[${l.created_at}] [${l.level}] [${l.module}] ${l.action}`);
    console.log(JSON.stringify(l.details, null, 2));
  });

  const { data: interactions } = await supabase
    .from('interactions')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true });

  console.log('--- INTERACTIONS ---');
  interactions.forEach(i => {
    console.log(`[${i.created_at}] [${i.sender_type}] ${i.message_content}`);
  });
}

run();
