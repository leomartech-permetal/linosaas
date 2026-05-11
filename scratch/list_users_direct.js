const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ykgcoatnzmbpltcvouii.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZ2NvYXRuem1icGx0Y3ZvdWlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA4MTE5OSwiZXhwIjoyMDkzNjU3MTk5fQ.T9IgY0uqwLpd-5eRs55UZZ0wxC4t6Y9tgOE3NRgrpLI'
);

async function listUsers() {
  console.log("Listando usuários da tabela admin_users...");
  const { data, error } = await supabase.from('admin_users').select('email, name, role');
  if (error) {
    console.error("Erro ao buscar usuários:", error);
    return;
  }
  console.log("Usuários encontrados:");
  console.log(JSON.stringify(data, null, 2));
}

listUsers();
