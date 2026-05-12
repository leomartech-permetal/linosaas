const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ykgcoatnzmbpltcvouii.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZ2NvYXRuem1icGx0Y3ZvdWlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA4MTE5OSwiZXhwIjoyMDkzNjU3MTk5fQ.T9IgY0uqwLpd-5eRs55UZZ0wxC4t6Y9tgOE3NRgrpLI'
);

async function run() {
  const query = `
    ALTER TABLE public.routing_rules ADD COLUMN IF NOT EXISTS is_express BOOLEAN DEFAULT false;
  `;
  
  console.log('Tentando migração via RPC exec_sql...');
  
  const { error } = await supabase.rpc('exec_sql', { sql_string: query });
  
  if (error) {
    console.error('Falha via RPC:', error.message);
    console.log('Se falhar, rode manualmente no SQL Editor do Supabase:');
    console.log(query);
  } else {
    console.log('✅ Coluna is_express adicionada com sucesso!');
  }
}

run();
