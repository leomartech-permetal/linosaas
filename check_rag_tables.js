const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://wnnvkdwbwqxtzuadtqtp.supabase.co',
  'sb_publishable_evY8fKDtZdRWpIw7wNP-mw_Qrk7sHuF'
);

async function testTables() {
  // Testar se rag_documents existe
  const { data: ragTest, error: ragErr } = await supabase.from('rag_documents').select('id').limit(1);
  if (ragErr) {
    console.log('❌ Tabela rag_documents NÃO existe. Erro:', ragErr.message);
    console.log('\n⚠️ Execute o SQL abaixo no Supabase Dashboard (SQL Editor):');
    console.log('='.repeat(60));
    console.log(`
CREATE TABLE IF NOT EXISTS public.rag_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) DEFAULT 'text',
    content TEXT,
    file_url TEXT,
    file_size INTEGER,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.skill_rag_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID REFERENCES public.skills(id) ON DELETE CASCADE,
    rag_document_id UUID REFERENCES public.rag_documents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(skill_id, rag_document_id)
);

ALTER TABLE public.rag_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_rag_links DISABLE ROW LEVEL SECURITY;
    `);
    console.log('='.repeat(60));
  } else {
    console.log('✅ Tabela rag_documents já existe! Registros:', ragTest?.length || 0);
  }

  // Testar skill_rag_links
  const { data: linkTest, error: linkErr } = await supabase.from('skill_rag_links').select('id').limit(1);
  if (linkErr) {
    console.log('❌ Tabela skill_rag_links NÃO existe.');
  } else {
    console.log('✅ Tabela skill_rag_links já existe! Registros:', linkTest?.length || 0);
  }
}

testTables();
