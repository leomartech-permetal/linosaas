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

async function checkRule1() {
  const { data: rules } = await supabase.from('routing_rules').select('*').order('priority', { ascending: true });
  console.log('--- REGRAS DE ROTEAMENTO (ORDENADAS POR PRIORIDADE) ---');
  rules.forEach((r, idx) => {
    console.log(`Regra ${idx + 1} (Prioridade ${r.priority}): ID: ${r.id} | seller_ids: ${r.seller_ids} | product_ids: ${r.product_ids?.slice(0,3)}...`);
  });
}

checkRule1();
