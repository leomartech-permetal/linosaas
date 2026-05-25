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

async function checkRoutingRules() {
  console.log('--- BUSCANDO REGRAS DE ROTEAMENTO DETALHADAS ---');
  const { data: rules, error: errRules } = await supabase.from('routing_rules').select('*');
  if (errRules) {
    console.error('Erro rules:', errRules);
    return;
  }

  // Buscar produtos, regiões e segmentos para mapear IDs
  const { data: products } = await supabase.from('products').select('id, name');
  const { data: regions } = await supabase.from('regions').select('id, name, ddd_codes');
  const { data: segments } = await supabase.from('segments').select('id, name');
  const { data: users } = await supabase.from('admin_users').select('id, name');

  const prodMap = {}; products?.forEach(p => prodMap[p.id] = p.name);
  const regMap = {}; regions?.forEach(r => regMap[r.id] = `${r.name} (${r.ddd_codes.join(',')})`);
  const segMap = {}; segments?.forEach(s => segMap[s.id] = s.name);
  const userMap = {}; users?.forEach(u => userMap[u.id] = u.name);

  rules?.forEach((r, index) => {
    console.log(`\nRegra ${index + 1}: ID: ${r.id}`);
    console.log(`- Equipe (team_id): ${r.team_id}`);
    console.log(`- Prioridade: ${r.priority}`);
    console.log(`- Express: ${r.is_express}`);
    console.log(`- Vendedor Atribuído (legado): ${userMap[r.assigned_user_id] || 'Nenhum'}`);
    console.log(`- Vendedores Fila (seller_ids):`, r.seller_ids?.map(id => userMap[id] || id));
    console.log(`- Produtos (product_ids):`, r.product_ids?.map(id => prodMap[id] || id));
    console.log(`- Regiões (region_ids):`, r.region_ids?.map(id => regMap[id] || id));
    console.log(`- Segmento (segment_id): ${segMap[r.segment_id] || 'Nenhum'}`);
  });
}

checkRoutingRules();
