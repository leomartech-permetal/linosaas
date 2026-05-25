const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://wnnvkdwbwqxtzuadtqtp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndubnZrZHdid3F4dHp1YWR0cXRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMwNDc3MywiZXhwIjoyMDkyODgwNzczfQ.qV4j9sgUiAvoxf15prEQJC2gqRqKJeMlcXLo7X_xrck'
);

async function test() {
  const { data: docs } = await sb.from('rag_documents').select('name, content').eq('name', 'rag_furo_redondo.txt');
  if (docs && docs.length > 0) {
    console.log(docs[0].content);
  } else {
    console.log('Documento não encontrado');
  }
}

test().catch(console.error);
