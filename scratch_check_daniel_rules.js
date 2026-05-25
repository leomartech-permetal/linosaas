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
  const { data: users } = await supabase.from('admin_users').select('id, name').ilike('name', '%Daniel%');
  console.log('Daniel:', users);
  
  if (users.length > 0) {
    const { data: rules } = await supabase.from('routing_rules').select('*');
    for (const r of rules) {
      if (r.seller_ids && r.seller_ids.includes(users[0].id) || r.assigned_user_id === users[0].id) {
        console.log('Rule matching Daniel:', r);
      }
    }
  }
}

run();
