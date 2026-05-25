const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://wnnvkdwbwqxtzuadtqtp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndubnZrZHdid3F4dHp1YWR0cXRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMwNDc3MywiZXhwIjoyMDkyODgwNzczfQ.qV4j9sgUiAvoxf15prEQJC2gqRqKJeMlcXLo7X_xrck'
);

async function test() {
  const { data: docs } = await sb.from('rag_documents').select('content').eq('name', 'rag_furo_redondo.txt').single();
  if (docs) {
    const lines = docs.content.split('\n');
    const idx = lines.findIndex(l => l.includes('### Furo 2,00 mm'));
    if (idx !== -1) {
      console.log(lines.slice(idx, idx + 15).join('\n'));
    } else {
      console.log('Não achou Furo 2,00 mm');
    }
  }
}

test().catch(console.error);
