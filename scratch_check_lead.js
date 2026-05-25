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

async function checkRoutingAndUsers() {
  console.log('--- ADMIN USERS ---');
  const { data: users, error: errUsers } = await supabase
    .from('admin_users')
    .select('id, name, email, role, whatsapp_number, team_id');
  if (errUsers) console.error(errUsers);
  else console.log(users);

  console.log('\n--- TEAMS ---');
  const { data: teams, error: errTeams } = await supabase
    .from('teams')
    .select('*');
  if (errTeams) console.error(errTeams);
  else console.log(teams);

  console.log('\n--- ROUTING RULES ---');
  const { data: rules, error: errRules } = await supabase
    .from('routing_rules')
    .select('*');
  if (errRules) console.error(errRules);
  else console.log(rules);
}

checkRoutingAndUsers();
