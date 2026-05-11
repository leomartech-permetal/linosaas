require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function listUsers() {
  console.log("Listando usuários da tabela admin_users...");
  const { data, error } = await supabase.from('admin_users').select('id, name, email, role, active');
  if (error) {
    console.error("Erro ao buscar usuários:", error);
    return;
  }
  console.table(data);
}

listUsers();
