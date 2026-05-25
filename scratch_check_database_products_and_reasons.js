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

async function checkDetails() {
  // 1. Mostrar produtos e seus sinônimos
  console.log('--- PRODUCTS IN DATABASE ---');
  const { data: products } = await supabase.from('products').select('id, name, synonyms');
  products.forEach(p => console.log(`- ${p.name} | ID: ${p.id} | Sinônimos: ${p.synonyms}`));

  // 2. Mostrar segmentos e suas keywords
  console.log('\n--- SEGMENTS IN DATABASE ---');
  const { data: segments } = await supabase.from('segments').select('id, name, keywords');
  segments.forEach(s => console.log(`- ${s.name} | ID: ${s.id} | Keywords: ${s.keywords}`));

  // 3. Simular a busca do produto com "Chapa perfurada" e segmento com "filtro em máquinas"
  console.log('\n--- TESTE DE RESOLUÇÃO ---');
  
  const textoProduto = 'Chapa perfurada';
  const lowerProd = textoProduto.toLowerCase();
  let resolvedProd = null;
  for (const p of products) {
    if (p.name.toLowerCase().includes(lowerProd) || lowerProd.includes(p.name.toLowerCase())) {
      resolvedProd = p;
      console.log(`Match por nome: "${p.name}" com "${textoProduto}"`);
      break;
    }
    const syns = p.synonyms || [];
    for (const s of syns) {
      if (lowerProd.includes(s.toLowerCase()) || s.toLowerCase().includes(lowerProd)) {
        resolvedProd = p;
        console.log(`Match por sinônimo: "${s}" do produto "${p.name}" com "${textoProduto}"`);
        break;
      }
    }
    if (resolvedProd) break;
  }
  console.log('Produto resolvido final:', resolvedProd ? resolvedProd.name : 'Nulo');

  const textoAplicacao = 'filtro em máquinas';
  const lowerApp = textoAplicacao.toLowerCase();
  let resolvedSeg = null;
  for (const seg of segments) {
    const kws = seg.keywords || [];
    for (const kw of kws) {
      if (lowerApp.includes(kw.toLowerCase())) {
        resolvedSeg = seg;
        console.log(`Match por keyword: "${kw}" do segmento "${seg.name}" com "${textoAplicacao}"`);
        break;
      }
    }
    if (resolvedSeg) break;
  }
  console.log('Segmento resolvido final:', resolvedSeg ? resolvedSeg.name : 'Nulo');
}

checkDetails();
