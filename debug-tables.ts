import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ykgcoatnzmbpltcvouii.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZ2NvYXRuem1icGx0Y3ZvdWlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA4MTE5OSwiZXhwIjoyMDkzNjU3MTk5fQ.T9IgY0uqwLpd-5eRs55UZZ0wxC4t6Y9tgOE3NRgrpLI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.rpc('get_tables'); // Or a direct postgrest query
  // Let's just query a known table like tenant_config
  const res1 = await supabase.from('tenant_config').select('id');
  console.log('tenant_config:', res1.error ? res1.error : 'OK');
  
  // Let's fetch the list of tables from information_schema if possible using a REST call or we can't.
  const res2 = await supabase.from('clients').select('id').limit(1);
  console.log('clients:', res2.error ? res2.error : 'OK');
}

main().catch(console.error);
