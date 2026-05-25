const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://wnnvkdwbwqxtzuadtqtp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndubnZrZHdid3F4dHp1YWR0cXRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMwNDc3MywiZXhwIjoyMDkyODgwNzczfQ.qV4j9sgUiAvoxf15prEQJC2gqRqKJeMlcXLo7X_xrck'
);

async function test() {
  const { data: brands } = await sb.from('brands').select('*');
  console.log('--- Brands ---');
  console.log(brands);

  const { data: teams } = await sb.from('teams').select('*');
  console.log('\n--- Teams ---');
  console.log(teams);

  const { data: products } = await sb.from('products').select('id, name, synonyms, is_express_eligible, express_max_qty, brand_id');
  console.log('\n--- Products ---');
  console.log(products);

  const { data: rules } = await sb.from('routing_rules').select('*');
  console.log('\n--- Routing Rules ---');
  console.log(rules);
}

test().catch(console.error);
