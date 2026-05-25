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

async function run() {
  // Pegar master prompt
  const { data: config } = await supabase.from('tenant_config').select('master_prompt').limit(1).single();
  fs.writeFileSync('scratch_master_prompt.txt', config?.master_prompt || '(vazio)');
  console.log('Master prompt salvo em scratch_master_prompt.txt');

  // Listar todas as skills
  const { data: skills } = await supabase.from('skills').select('id, name, category, type').order('name');
  console.log('\n=== SKILLS ===');
  skills?.forEach(s => console.log(`- ${s.name} [${s.category}] [${s.type}]`));

  // Buscar skill 30 - preparar_payload_roteamento
  const { data: skillPayload } = await supabase.from('skills').select('*').ilike('name', '%payload%').single();
  if (skillPayload) {
    fs.writeFileSync('scratch_skill_payload.txt', JSON.stringify(skillPayload, null, 2));
    console.log('\nSkill payload_roteamento salva em scratch_skill_payload.txt');
  } else {
    console.log('\nSkill preparar_payload_roteamento NAO ENCONTRADA no banco');
  }
}

run();
