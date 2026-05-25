const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://wnnvkdwbwqxtzuadtqtp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndubnZrZHdid3F4dHp1YWR0cXRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMwNDc3MywiZXhwIjoyMDkyODgwNzczfQ.qV4j9sgUiAvoxf15prEQJC2gqRqKJeMlcXLo7X_xrck'
);

async function test() {
  const { data: skills } = await sb.from('skills').select('id, name').ilike('name', '%chapa_perfurada%');
  console.log('Skill chapa_perfurada:', skills);
  if (skills && skills.length > 0) {
    const { data: links } = await sb.from('skill_rag_links').select('rag_document_id').eq('skill_id', skills[0].id);
    console.log('Links de RAG:', links);
    if (links && links.length > 0) {
      const { data: docs } = await sb.from('rag_documents').select('name, content').in('id', links.map(l => l.rag_document_id));
      for (const d of docs) {
        console.log(`\n=================== ${d.name} ===================`);
        console.log(d.content ? d.content.substring(0, 1500) + '...' : 'Vazio');
      }
    }
  }
}

test().catch(console.error);
