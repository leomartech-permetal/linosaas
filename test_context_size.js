const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://wnnvkdwbwqxtzuadtqtp.supabase.co', 'sb_publishable_evY8fKDtZdRWpIw7wNP-mw_Qrk7sHuF');

async function test() {
  const { data: config } = await supabase.from('tenant_config').select('master_prompt').limit(1).single();
  console.log('Master prompt length:', config?.master_prompt?.length || 0);

  const { data: skills } = await supabase.from('skills').select('*').eq('active', true);
  console.log('Skills count:', skills?.length || 0);
  
  if (skills) {
    for (const skill of skills) {
      console.log(`Skill ${skill.name} length: ${skill.prompt?.length || 0}`);
      const { data: links } = await supabase.from('skill_rag_links').select('rag_document_id').eq('skill_id', skill.id);
      if (links && links.length > 0) {
        const ragIds = links.map(l => l.rag_document_id);
        const { data: ragDocs } = await supabase.from('rag_documents').select('name, content').in('id', ragIds).eq('active', true);
        if (ragDocs) {
          for (const doc of ragDocs) {
            console.log(`RAG doc ${doc.name} length: ${doc.content?.length || 0}`);
          }
        }
      }
    }
  }

  const { data: products } = await supabase.from('products').select('name, synonyms');
  console.log('Products count:', products?.length || 0);
}

test();
