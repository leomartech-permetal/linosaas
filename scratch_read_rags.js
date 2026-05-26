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

async function analyzeRags() {
  try {
    const { data: rags, error } = await supabase.from('rag_documents').select('name, content').eq('active', true);
    if (error) throw error;

    console.log(`=== ANÁLISE DE TODOS OS RAGS (${rags.length}) ===`);
    rags.forEach(r => {
      console.log(`\n==================================================`);
      console.log(`DOCUMENTO: "${r.name}"`);
      console.log(`==================================================`);
      if (!r.content) {
        console.log('(Sem conteúdo)');
        return;
      }
      
      // Pega as primeiras 15 linhas do conteúdo para análise
      const lines = r.content.split('\n').slice(0, 20);
      console.log(lines.join('\n'));
      console.log('...');
    });
  } catch (error) {
    console.error('Erro ao analisar RAGs:', error);
  }
}

analyzeRags();
