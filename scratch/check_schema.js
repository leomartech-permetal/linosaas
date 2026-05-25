const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8');
env.split('\n').forEach(line => {
  const [k, v] = line.split('=');
  if (k && v) process.env[k.trim()] = v.trim().replace(/^['"\x22]|['"\x22]$/g, '');
});

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const sql = `
    SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
    WHERE constraint_type = 'FOREIGN KEY' AND tc.table_name='leads';
  `;
  
  // We don't have exec_sql RPC maybe, but let's try calling it or another way
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  console.log('Result:', data || error);
}
run();
