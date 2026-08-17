const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.readFileSync('.env.local', 'utf8');
const env = {};
envLocal.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    env[match[1]] = match[2].trim();
  }
});

const supabase = createClient(
  env['NEXT_PUBLIC_SUPABASE_URL'],
  env['SUPABASE_SERVICE_ROLE_KEY']
);

async function main() {
  const { data, error } = await supabase.from('admin_users').select('id, name, email, password, role');
  if (error) {
    console.error('Error fetching users:', error);
  } else {
    console.log('Users in database:', JSON.stringify(data, null, 2));
  }
}

main();
