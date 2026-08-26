const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: docs } = await supabase.from('rag_documents').select('id, name');
  for (const doc of docs) {
    if (!doc.name.startsWith('Catálogo -')) {
      const { error } = await supabase.from('rag_documents').delete().eq('id', doc.id);
      if (error) console.error("Erro ao deletar", doc.name, error);
      else console.log("Deletado:", doc.name);
    }
  }
}
run();
