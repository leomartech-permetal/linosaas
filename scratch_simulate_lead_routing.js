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
  // 1. Full routing simulation for this lead
  // Phone: 5516991415319 -> DDD 16 -> SP02
  // Product: Chapa Perfurada -> id '1e0f12f3-c379-4b60-8c71-8bab59b899fe'
  // Segment: construcao -> id '623560fc-54ee-4931-ae5c-a3105649219e'
  // Region: SP02 -> id '72ff18fe-c942-414f-a722-60faf3a84687'

  const region = { id: '72ff18fe-c942-414f-a722-60faf3a84687', name: 'SP02' };
  const product = { id: '1e0f12f3-c379-4b60-8c71-8bab59b899fe', name: 'Chapa Perfurada' };
  const segment = { id: '623560fc-54ee-4931-ae5c-a3105649219e', name: 'Construcao' };

  const { data: allRules } = await supabase
    .from('routing_rules')
    .select('*')
    .order('priority', { ascending: true });

  console.log('\n=== ROUTING SIMULATION ===');
  console.log(`Product: ${product.name} (${product.id})`);
  console.log(`Region: ${region.name} (${region.id})`);
  console.log(`Segment: ${segment.name} (${segment.id})`);
  console.log('\n--- Matching rules ---\n');

  for (const r of allRules) {
    let skip = false;
    let reasons = [];

    // Region check
    const hasRegionFilter = (r.region_ids?.length > 0) || r.region;
    if (hasRegionFilter && region) {
      const inNewIds = r.region_ids?.length > 0 && r.region_ids.includes(region.id);
      const inLegacy = r.region && (region.name.toLowerCase().includes(r.region.toLowerCase()) || r.region === '*');
      if (!inNewIds && !inLegacy) { skip = true; reasons.push('region mismatch'); }
    } else if (hasRegionFilter && !region) { skip = true; reasons.push('no region'); }

    // Product check
    const hasProductFilter = (r.product_ids?.length > 0) || r.product_id;
    if (hasProductFilter && product) {
      const inNewIds = r.product_ids?.length > 0 && r.product_ids.includes(product.id);
      const inLegacy = r.product_id === product.id;
      if (!inNewIds && !inLegacy) { skip = true; reasons.push('product mismatch'); }
    } else if (hasProductFilter && !product) { skip = true; reasons.push('no product'); }

    // Segment check
    if (r.segment_id && segment?.id !== r.segment_id) { skip = true; reasons.push('segment mismatch'); }

    console.log(`Rule priority=${r.priority} id=${r.id}`);
    console.log(`  seller_ids=${JSON.stringify(r.seller_ids)}`);
    console.log(`  -> ${skip ? 'SKIP: ' + reasons.join(', ') : 'MATCH!'}`);
    
    if (!skip) {
      console.log('  *** FIRST MATCH - would route here ***');
      break;
    }
  }
}

run();
