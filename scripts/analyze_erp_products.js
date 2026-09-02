const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// 1. Ler credenciais
const env = fs.readFileSync('.env.local', 'utf-8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/)[1].trim();
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/)[1].trim();
const supabase = createClient(url, key);

// 2. Ler CSV
const content = fs.readFileSync('scratch_produtos.csv', 'utf-8');
const lines = content.split(/\r?\n/).filter(Boolean);

console.log('Total de linhas no CSV:', lines.length);

function parseCSVLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

const ignoreTerms = [
  'SUCATA', 'SUC ', 'SERVICO', 'GALVANIZACAO', 'LINGOTE', 'BOBINA DE ACO CARBONO DE TERCEIRO', 
  'BOBINA DE INOX DE TERCEIRO', 'BOBINA DE TERCEIRO', 'TERCEIRO', 'TINTA', 'PARAFUSO', 
  'REFORCO CABINE', 'ELETROCALHA', 'FILTRO', 'OLEO', 'LIXA', 'DISCO DE CORTE', 'GRAXA',
  'SOLDA', 'ARAME', 'EMBALAGEM', 'FITA', 'PALETE', 'ETIQUETA', 'MATERIA PRIMA'
];

function shouldIgnore(desc, familia) {
  const upper = (desc + ' ' + familia).toUpperCase();
  for (const term of ignoreTerms) {
    if (upper.includes(term)) return true;
  }
  return false;
}

async function runAnalysis() {
  const validProducts = [];
  let ignoredCount = 0;

  for (let i = 2; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length >= 3) {
      const cod = parts[0].trim();
      const familia = parts[1].trim();
      const desc = parts[2].trim();

      if (!desc || shouldIgnore(desc, familia)) {
        ignoredCount++;
        continue;
      }

      validProducts.push({ cod, familia, desc });
    }
  }

  console.log('----------------------------------------------------');
  console.log(`Itens ignorados (sucata, insumos, serviços, terceiros): ${ignoredCount}`);
  console.log(`Produtos válidos identificados: ${validProducts.length}`);
  console.log('----------------------------------------------------');

  // Buscar todas as 2.450 variantes do Supabase
  const { data: catalogVariants } = await supabase
    .from('catalog_variants_v3')
    .select('variant_id, brand_slug, family_slug, product_slug, category_slug, technical_attributes');

  console.log(`Variantes carregadas do Supabase: ${catalogVariants ? catalogVariants.length : 0}`);

  // Categorização dos itens válidos do ERP
  const categoriasDetectadas = {
    'Chapas Perfuradas (Furo Redondo/Quadrado/Oblongo/Hex/Losang)': [],
    'Chapa Perfurada Tipo Cubana / Centrífuga / Usina': [],
    'Chapas Expandidas / Telas Expandidas': [],
    'Rib Lath (Nervurada / Construção)': [],
    'Chapa Conidur / Microperfurada': [],
    'Chapa Níquel / Galvano / Filtração Especial': [],
    'Chapas Tubulares / Tubos Perfurados': [],
    'Gradis & Portões (Metalgrade)': [],
    'Chapas Recalcadas / Pisos Antiderrapantes / Ladrilhos': [],
    'Telas Antiofuscantes (Rodovias)': [],
    'Brises & Fachadas (PSA)': [],
    'Forros Metálicos': [],
    'Outros Itens Especiais': []
  };

  validProducts.forEach(p => {
    const d = p.desc.toUpperCase();
    if (d.includes('RIB LATH') || d.includes('RIBLATH')) {
      categoriasDetectadas['Rib Lath (Nervurada / Construção)'].push(p);
    } else if (d.includes('CONIDUR') || d.includes('CONIDUR')) {
      categoriasDetectadas['Chapa Conidur / Microperfurada'].push(p);
    } else if (d.includes('NIQUEL') || d.includes('NÍQUEL')) {
      categoriasDetectadas['Chapa Níquel / Galvano / Filtração Especial'].push(p);
    } else if (d.includes('TUBULAR') || d.includes('TUBO PERF') || d.includes('TUBO')) {
      categoriasDetectadas['Chapas Tubulares / Tubos Perfurados'].push(p);
    } else if (d.includes('CUBANA') || d.includes('CENTRIFUGA') || d.includes('SUCRO')) {
      categoriasDetectadas['Chapa Perfurada Tipo Cubana / Centrífuga / Usina'].push(p);
    } else if (d.includes('GRADIL') || d.includes('PORTAO') || d.includes('PORTÃO') || d.includes('STADIUM') || d.includes('ARTIS') || d.includes('OMEGA') || d.includes('LEONE')) {
      categoriasDetectadas['Gradis & Portões (Metalgrade)'].push(p);
    } else if (d.includes('RECALCAD') || d.includes('PISO') || d.includes('LADRILHO') || d.includes('DEGRAU')) {
      categoriasDetectadas['Chapas Recalcadas / Pisos Antiderrapantes / Ladrilhos'].push(p);
    } else if (d.includes('ANTIOFUSCANTE')) {
      categoriasDetectadas['Telas Antiofuscantes (Rodovias)'].push(p);
    } else if (d.includes('BRISE') || d.includes('FACHADA')) {
      categoriasDetectadas['Brises & Fachadas (PSA)'].push(p);
    } else if (d.includes('FORRO')) {
      categoriasDetectadas['Forros Metálicos'].push(p);
    } else if (d.includes('EXPANDID') || d.includes('TELA EXP')) {
      categoriasDetectadas['Chapas Expandidas / Telas Expandidas'].push(p);
    } else if (d.includes('PERFURAD') || d.includes('FURO')) {
      categoriasDetectadas['Chapas Perfuradas (Furo Redondo/Quadrado/Oblongo/Hex/Losang)'].push(p);
    } else {
      categoriasDetectadas['Outros Itens Especiais'].push(p);
    }
  });

  console.log('\n=== DISTRIBUIÇÃO DOS PRODUTOS REAIS DO ERP ===');
  for (const [cat, items] of Object.entries(categoriasDetectadas)) {
    console.log(`${cat}: ${items.length} itens`);
    if (items.length > 0 && items.length <= 5) {
      items.forEach(it => console.log(`  - [${it.cod}] ${it.desc.slice(0, 85)}`));
    } else if (items.length > 5) {
      console.log(`  - Exemplo 1: [${items[0].cod}] ${items[0].desc.slice(0, 85)}`);
      console.log(`  - Exemplo 2: [${items[1].cod}] ${items[1].desc.slice(0, 85)}`);
      console.log(`  - Exemplo 3: [${items[2].cod}] ${items[2].desc.slice(0, 85)}`);
    }
  }
}

runAnalysis().catch(console.error);
