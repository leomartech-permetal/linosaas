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

async function listAll() {
  try {
    console.log('=== TODOS OS RAG DOCUMENTS ===');
    const { data: rags, error: rError } = await supabase.from('rag_documents').select('name, active');
    if (rError) throw rError;
    rags.forEach((r, idx) => {
      console.log(`${idx + 1}. Nome: "${r.name}" | Ativo: ${r.active}`);
    });
  } catch (error) {
    console.error('Erro:', error);
  }
}

listAll();
