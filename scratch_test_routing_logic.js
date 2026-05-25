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
  const { data: rules } = await supabase.from('routing_rules').select('*').order('priority', { ascending: true });
  
  const region = null;
  // Let's pretend product and segment match Douglas rule.
  
  for (const r of rules) {
    let match = true;
    const hasRegionFilter = (r.region_ids?.length > 0) || r.region;
    
    if (hasRegionFilter && !region) {
      match = false; // skips
    }
    
    if (match) {
      console.log('Would match rule:', r.id, r.seller_ids, r.assigned_user_id);
    }
  }
}

run();
