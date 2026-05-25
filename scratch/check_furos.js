const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://wnnvkdwbwqxtzuadtqtp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndubnZrZHdid3F4dHp1YWR0cXRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMwNDc3MywiZXhwIjoyMDkyODgwNzczfQ.qV4j9sgUiAvoxf15prEQJC2gqRqKJeMlcXLo7X_xrck'
);

async function test() {
  const { data: docs } = await sb.from('rag_documents').select('content').eq('name', 'rag_furo_redondo.txt').single();
  if (docs) {
    const lines = docs.content.split('\n');
    console.log('Total de linhas:', lines.length);
    const matches = lines.filter(l => l.includes('Furo '));
    console.log('Todos os furos listados:', matches);
  }
}

test().catch(console.error);
