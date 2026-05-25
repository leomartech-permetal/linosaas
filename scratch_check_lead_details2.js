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
  const { data: leads } = await supabase
    .from('leads')
    .select('*, seller:current_owner_id(name, whatsapp_number)')
    .like('whatsapp_number', '%5516991415319%')
    .order('created_at', { ascending: false });

  console.log('Leads encontrados:', leads.length);
  if (leads.length > 0) {
    console.log(JSON.stringify(leads[0], null, 2));
  }
}

run();
