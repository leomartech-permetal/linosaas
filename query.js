const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://wnnvkdwbwqxtzuadtqtp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndubnZrZHdid3F4dHp1YWR0cXRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMwNDc3MywiZXhwIjoyMDkyODgwNzczfQ.qV4j9sgUiAvoxf15prEQJC2gqRqKJeMlcXLo7X_xrck');
async function run() {
  const { data, error } = await supabase.from('admin_users').select('email, password, role');
  console.log(data);
}
run();
