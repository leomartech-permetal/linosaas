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
  
  // Find a valid user ID for test
  const { data: users } = await supabase.from('admin_users').select('id').limit(1);
  const userId = users[0].id;
  
  const { data, error } = await supabase.from('leads').update({
    current_owner_id: userId,
    status: 'WAITING_SELLER',
    sent_to_seller_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', leadId).select();

  console.log('Error:', error);
  console.log('Data:', data);
}

run();
