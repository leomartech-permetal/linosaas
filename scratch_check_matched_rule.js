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
  const { data: rule } = await supabase.from('routing_rules').select('*').eq('id', 'b96e0240-9762-42c7-b57a-05f9bfac6df9').single();
  console.log('Rule:', rule);
  
  if (rule.seller_ids?.length > 0) {
    const { data: sellers } = await supabase.from('admin_users').select('id, name').in('id', rule.seller_ids);
    console.log('Sellers:', sellers);
  }
}

run();
