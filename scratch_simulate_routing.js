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

const variables = {
  produto: 'Chapa perfurada',
  ddd: '16',
  quantidade: '200 m²',
  aplicacao: 'filtro em máquinas',
  nome_cliente: 'Leo Costa Oliveira',
  empresa: 'AGRAP SUco de Laranja',
  cnpj: '169854854212',
  email: 'agrapo@teste.com',
  segmento_detectado: 'filtro em máquinas'
};

function normalizar(str) {
  if (!str) return '';
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

async function simulate() {
  console.log('--- SIMULANDO ROTEAMENTO CORRIGIDO ---');
  
  // 1. Resolver produto
  const { data: products } = await supabase.from('products').select('*, brands(name)');
  let product = null;
  const cleanText = normalizar(variables.produto);
  
  // Passo 1.1: Match exato pelo nome
  for (const p of products) {
    if (normalizar(p.name) === cleanText) {
      product = p;
      console.log(`Match exato pelo nome: "${p.name}"`);
      break;
    }
  }
  
  // Passo 1.2: Match contido pelo nome
  if (!product) {
    for (const p of products) {
      const pName = normalizar(p.name);
      if (pName.includes(cleanText) || cleanText.includes(pName)) {
        product = p;
        console.log(`Match contido pelo nome: "${p.name}"`);
        break;
      }
    }
  }

  // Passo 1.3: Match por sinônimos (apenas se o termo contém o sinônimo completo)
  if (!product) {
    for (const p of products) {
      const syns = p.synonyms || [];
      for (const s of syns) {
        const cleanSyn = normalizar(s);
        if (cleanText.includes(cleanSyn) || cleanSyn === cleanText) {
          product = p;
          console.log(`Match por sinônimo: "${s}" do produto "${p.name}"`);
          break;
        }
      }
      if (product) break;
    }
  }
  console.log(`Produto Resolvido Final: ${product ? product.name : 'Nulo'} (ID: ${product ? product.id : 'N/A'})`);

  // 2. Resolver região
  const { data: regions } = await supabase.from('regions').select('*');
  let region = null;
  for (const r of regions) {
    const codes = r.ddd_codes || [];
    if (codes.includes(variables.ddd)) {
      region = r;
      break;
    }
  }
  console.log(`Região Resolvida: ${region ? region.name : 'Nulo'} (ID: ${region ? region.id : 'N/A'})`);

  // 3. Resolver segmento
  const { data: segments } = await supabase.from('segments').select('*');
  let segment = null;
  const cleanApp = normalizar(variables.aplicacao);
  for (const seg of segments) {
    const kws = seg.keywords || [];
    for (const kw of kws) {
      const cleanKw = normalizar(kw);
      if (cleanApp.includes(cleanKw)) {
        segment = seg;
        console.log(`Match de segmento por keyword: "${kw}" -> "${seg.name}"`);
        break;
      }
    }
    if (segment) break;
  }
  console.log(`Segmento Resolvido: ${segment ? segment.name : 'Nulo'} (ID: ${segment ? segment.id : 'N/A'})`);

  // 4. Buscar todas as regras
  const { data: allRules } = await supabase
    .from('routing_rules')
    .select('*')
    .order('priority', { ascending: true });

  console.log(`\nTestando ${allRules.length} regras de roteamento:`);
  
  // Buscar mapeamento de usuários para exibir nomes
  const { data: users } = await supabase.from('admin_users').select('id, name');
  const userMap = {}; users.forEach(u => userMap[u.id] = u.name);

  let matchedRule = null;
  for (let i = 0; i < allRules.length; i++) {
    const r = allRules[i];
    
    // Região
    const hasRegionFilter = (r.region_ids?.length > 0) || r.region;
    if (hasRegionFilter && region) {
      const inNewIds = r.region_ids?.length > 0 && r.region_ids.includes(region.id);
      const inLegacy = r.region && (region.name.toLowerCase().includes(r.region.toLowerCase()) || r.region === '*');
      if (!inNewIds && !inLegacy) continue;
    } else if (hasRegionFilter && !region) continue;

    // Produto
    const hasProductFilter = (r.product_ids?.length > 0) || r.product_id;
    if (hasProductFilter && product) {
      const inNewIds = r.product_ids?.length > 0 && r.product_ids.includes(product.id);
      const inLegacy = r.product_id === product.id;
      if (!inNewIds && !inLegacy) continue;
    } else if (hasProductFilter && !product) continue;

    // Segmento
    if (r.segment_id && segment?.id !== r.segment_id) continue;

    console.log(`\n-> [MATCH] Regra ${i + 1} confere! ID: ${r.id}`);
    console.log(`   Vendedores:`, r.seller_ids?.map(id => userMap[id] || id));
    matchedRule = r;
    break;
  }
}

simulate();
