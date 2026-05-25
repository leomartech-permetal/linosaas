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

async function checkRules() {
  const { data: rules } = await supabase.from('routing_rules').select('*').order('priority', { ascending: true });
  const { data: users } = await supabase.from('admin_users').select('id, name, whatsapp_number');
  const { data: products } = await supabase.from('products').select('id, name');
  const { data: segments } = await supabase.from('segments').select('id, name');
  const { data: regions } = await supabase.from('regions').select('id, name');

  const userMap = {}; users.forEach(u => userMap[u.id] = `${u.name} (${u.whatsapp_number})`);
  const prodMap = {}; products.forEach(p => prodMap[p.id] = p.name);
  const segMap = {}; segments.forEach(s => segMap[s.id] = s.name);
  const regMap = {}; regions.forEach(r => regMap[r.id] = r.name);

  console.log('--- REGRAS DE ROTEAMENTO DETALHADAS ---');
  rules.forEach((r, idx) => {
    const sellers = (r.seller_ids || []).map(id => userMap[id] || id).join(', ');
    const prods = (r.product_ids || []).map(id => prodMap[id] || id).join(', ');
    const regs = (r.region_ids || []).map(id => regMap[id] || id).join(', ');
    const seg = segMap[r.segment_id] || 'Qualquer';
    
    console.log(`\nRegra ${idx + 1} (Prioridade ${r.priority})`);
    console.log(`- Vendedores: ${sellers}`);
    console.log(`- Produtos: ${prods || r.product_id || 'Qualquer'}`);
    console.log(`- Regiões: ${regs || r.region || 'Qualquer'}`);
    console.log(`- Segmento: ${seg}`);
    console.log(`- Express: ${r.is_express}`);
  });
}

checkRules();
