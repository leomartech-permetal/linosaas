require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testDB() {
  console.log("Tentando inserir time...");
  const { data, error } = await supabase.from('teams').insert([{ name: "Equipe Teste Debug" }]);
  console.log("Erro:", error);
  console.log("Data:", data);
}

testDB();
