const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://wnnvkdwbwqxtzuadtqtp.supabase.co', 'sb_publishable_evY8fKDtZdRWpIw7wNP-mw_Qrk7sHuF');

async function seed() {
  // 1. REGIÕES
  const regions = [
    { name: 'CENTRO_OESTE', ddd_codes: ['61','62','64','65','66','67'] },
    { name: 'NORDESTE', ddd_codes: ['71','73','74','75','77','79','81','82','83','84','85','86','87','88','89','98','99'] },
    { name: 'NORTE', ddd_codes: ['63','68','69','91','92','93','94','95','96','97'] },
    { name: 'MG', ddd_codes: ['31','32','33','34','35','36','37','38'] },
    { name: 'RJ', ddd_codes: ['21','22','24'] },
    { name: 'ES', ddd_codes: ['27','28'] },
    { name: 'SUL', ddd_codes: ['41','42','43','44','45','46','47','48','49','51','53','54','55'] },
    { name: 'SP01', ddd_codes: ['11','12','13','15'] },
    { name: 'SP02', ddd_codes: ['14','16','17','18','19'] },
  ];
  const { error: e1 } = await s.from('regions').upsert(regions, { onConflict: 'name', ignoreDuplicates: true });
  console.log('Regiões:', e1 ? '❌ ' + e1.message : '✅');

  // 2. SEGMENTOS
  const segments = [
    { name: 'Indústria', keywords: ['industria','industrial','máquina','maquina','equipamento','fábrica','fabrica'], collection_type: 'normal' },
    { name: 'Construção', keywords: ['construção','construcao','obra','reforma','construtora','serralheiro','serralheria','vidraceiro','esquadria','empreiteiro','empreita','arquitetura','prefeitura','licitação','licitacao'], collection_type: 'normal' },
    { name: 'Revenda', keywords: ['revenda','revender','revendedor','distribuidor'], collection_type: 'short' },
    { name: 'Belinox', keywords: ['belinox','belaco','belaço','chapa moeda','bobina moeda','tela moeda'], collection_type: 'short' },
    { name: 'Antiofuscante', keywords: ['antiofuscante','anti-ofuscante','anti ofuscante'], collection_type: 'short' },
  ];
  const { error: e2 } = await s.from('segments').insert(segments);
  console.log('Segmentos:', e2 ? '❌ ' + e2.message : '✅');

  // 3. MARCAS
  const brandNames = ['PSA PERMETAL', 'METALGRADE', 'PERMETAL', 'PERMETAL EXPRESS'];
  for (const name of brandNames) {
    const { data: existing } = await s.from('brands').select('id').ilike('name', name).limit(1);
    if (!existing || existing.length === 0) {
      await s.from('brands').insert([{ name }]);
    }
  }
  const { data: brands } = await s.from('brands').select('id, name');
  const brandMap = {};
  brands?.forEach(b => { brandMap[b.name.toUpperCase()] = b.id; });
  console.log('Marcas:', Object.keys(brandMap).length > 0 ? '✅' : '❌');

  // 4. PRODUTOS
  const products = [
    { name: 'Chapa Perfurada', synonyms: ['chapa furada','perfurada','chapa com furos'], brand: 'PERMETAL', express_max_qty: 'até 10 peças ou 20m2', is_express_eligible: true },
    { name: 'Chapa Expandida', synonyms: ['expandida','chapa expandido','metal expandido'], brand: 'PERMETAL', express_max_qty: 'até 10 peças ou 20m2', is_express_eligible: true },
    { name: 'Tela Expandida', synonyms: ['tela expandido','tela de aço expandida'], brand: 'PERMETAL', express_max_qty: 'até 10 peças', is_express_eligible: true },
    { name: 'Piso Industrial', synonyms: ['piso metalico','piso de aço','piso metal','piso metálico'], brand: 'METALGRADE', express_max_qty: 'até 10m2', is_express_eligible: true },
    { name: 'Grade de Piso', synonyms: ['grade piso','grating','grade metalica','grade metálica'], brand: 'METALGRADE', express_max_qty: 'até 10m linear', is_express_eligible: true },
    { name: 'Gradil Metálico', synonyms: ['gradil','orsograde','gradil artis','gradil stadium','gradil leve','gradil de ferro'], brand: 'METALGRADE', express_max_qty: 'até 10m linear', is_express_eligible: true },
    { name: 'Portão Gradil', synonyms: ['portão gradil','portao gradil','portão metalgrade'], brand: 'METALGRADE', express_max_qty: 'até 2 unidades', is_express_eligible: true },
    { name: 'Degrau em Grade de Piso', synonyms: ['degrau grade','degrau metalico','degrau metálico'], brand: 'METALGRADE', express_max_qty: 'até 10 unidades', is_express_eligible: true },
    { name: 'Bobina Moeda / Belinox', synonyms: ['bobina moeda','tela moeda','belinox','belaço','belaco','chapa moeda'], brand: 'PERMETAL', express_max_qty: null, is_express_eligible: false },
    { name: 'Chapa Recalcada', synonyms: ['recalcada','chapa recalcado','metal recalcado'], brand: 'PERMETAL', express_max_qty: 'até 10 peças', is_express_eligible: true },
    { name: 'Tela Antiofuscante', synonyms: ['antiofuscante','tela anti ofuscante','anti-ofuscante'], brand: 'PERMETAL', express_max_qty: null, is_express_eligible: false },
    { name: 'Fachada Metálica', synonyms: ['fachada','fachada metalica','revestimento metálico','painel arquitetônico'], brand: 'PSA PERMETAL', express_max_qty: null, is_express_eligible: false },
    { name: 'Forro Metálico', synonyms: ['forro','forro metalico','forro metálico'], brand: 'PSA PERMETAL', express_max_qty: null, is_express_eligible: false },
    { name: 'Brise Metálico', synonyms: ['brise','brise apolo','brise metalico','brise metálico'], brand: 'PSA PERMETAL', express_max_qty: null, is_express_eligible: false },
    { name: 'Painel Perfurado / Brise Artemis', synonyms: ['painel perfurado','brise artemis','painel artemis'], brand: 'PSA PERMETAL', express_max_qty: null, is_express_eligible: false },
  ];

  for (const p of products) {
    const brandId = brandMap[p.brand.toUpperCase()] || null;
    const { error } = await s.from('products').insert([{
      name: p.name, synonyms: p.synonyms, brand_id: brandId,
      express_max_qty: p.express_max_qty, is_express_eligible: p.is_express_eligible,
    }]);
    if (error) console.log(`  ❌ ${p.name}: ${error.message}`);
    else console.log(`  ✅ ${p.name}`);
  }

  console.log('\n🎉 Seed concluído!');
}
seed();
