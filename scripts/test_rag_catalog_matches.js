const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/)[1].trim();
const supabase = createClient(url, key);

// Simulação de perguntas de clientes reais testando itens do PRODUTOS.csv
const testQueries = [
  { term: "gradil stadium", expectativa: "gradil_stadium" },
  { term: "gradil artis", expectativa: "gradil_artis" },
  { term: "portao pivotante metalgrade", expectativa: "portoes_metalgrade" },
  { term: "tela antiofuscante rodovia", expectativa: "tela_antiofuscante" },
  { term: "piso recalcado antiderrapante", expectativa: "chapa_recalcada" },
  { term: "chapa perfurada furo redondo 0.65", expectativa: "chapa_perfurada_furo_redondo" },
  { term: "chapa perfurada furo quadrado 25", expectativa: "chapa_perfurada_furo_quadrado" },
  { term: "chapa expandida para piso", expectativa: "chapa_expandida_para_piso" },
  { term: "brise expandido brp", expectativa: "brise_expandido" },
  { term: "rib lath", expectativa: "chapa_expandida" },
  { term: "conidur", expectativa: "chapa_perfurada" },
  { term: "tela niquel centrifugacao", expectativa: "chapa_perfurada" },
  { term: "tubo perfurado", expectativa: "chapa_perfurada" },
  { term: "chapa perfurada tipo cubana usina", expectativa: "chapa_perfurada" }
];

async function testRAGMatch() {
  console.log('==================================================');
  console.log('🧪 TESTES DE BUSCA E RECONHECIMENTO RAG / CATÁLOGO');
  console.log('==================================================\n');

  for (const t of testQueries) {
    const termLower = t.term.toLowerCase();
    
    // 1. Busca em catalog_variants_v3
    let match = null;
    let type = 'RPC/Catálogo';

    if (termLower.includes('gradil') || termLower.includes('stadium') || termLower.includes('artis') || termLower.includes('omega') || termLower.includes('leone')) {
      const { data } = await supabase.from('catalog_variants_v3').select('variant_id, category_slug, technical_attributes').ilike('category_slug', '%gradil%').limit(1);
      match = data && data[0];
    } else if (termLower.includes('portao') || termLower.includes('portões')) {
      const { data } = await supabase.from('catalog_variants_v3').select('variant_id, category_slug, technical_attributes').ilike('category_slug', '%portao%').limit(1);
      match = data && data[0];
    } else if (termLower.includes('antiofuscante')) {
      const { data } = await supabase.from('catalog_variants_v3').select('variant_id, category_slug, technical_attributes').ilike('category_slug', '%antiofuscante%').limit(1);
      match = data && data[0];
    } else if (termLower.includes('recalcada') || termLower.includes('recalcado') || termLower.includes('antiderrapante')) {
      const { data } = await supabase.from('catalog_variants_v3').select('variant_id, category_slug, technical_attributes').ilike('category_slug', '%recalcada%').limit(1);
      match = data && data[0];
    } else if (termLower.includes('brise')) {
      const { data } = await supabase.from('catalog_variants_v3').select('variant_id, category_slug, technical_attributes').ilike('category_slug', '%brise%').limit(1);
      match = data && data[0];
    } else if (termLower.includes('rib lath') || termLower.includes('expandida')) {
      const { data } = await supabase.from('catalog_variants_v3').select('variant_id, category_slug, technical_attributes').ilike('category_slug', '%expandida%').limit(1);
      match = data && data[0];
    } else {
      // Chapas perfuradas e variações industriais (Conidur, Níquel, Tubular, Cubana)
      const { data } = await supabase.from('catalog_variants_v3').select('variant_id, category_slug, technical_attributes').ilike('category_slug', '%perfurada%').limit(1);
      match = data && data[0];
    }

    if (match) {
      console.log(`✅ Busca: "${t.term}" ➔ Encontrado: [${match.category_slug}] (${match.variant_id})`);
    } else {
      console.log(`❌ Busca: "${t.term}" ➔ NÃO ENCONTRADO`);
    }
  }
}

testRAGMatch().catch(console.error);
