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
  const { data, error } = await supabase.from('admin_users').select('id, name').limit(2);
  console.log('admin_users:', data);

  const { data: usersData, error: usersError } = await supabase.from('users').select('id, name').limit(2);
  console.log('users:', usersData, 'error:', usersError);
}

run();
