const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manual env parsing
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) {
    env[key.trim()] = value.join('=').trim();
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function dumpConfig() {
  console.log("=== TENANT CONFIG ===");
  const { data: config } = await supabase.from('tenant_config').select('*');
  console.log(JSON.stringify(config, null, 2));

  console.log("\n=== ACTIVE SKILLS ===");
  const { data: skills } = await supabase.from('skills').select('*').eq('active', true);
  console.log(JSON.stringify(skills, null, 2));

  console.log("\n=== RAG DOCUMENTS ===");
  const { data: rags } = await supabase.from('rag_documents').select('name, content').eq('active', true);
  console.log(JSON.stringify(rags, null, 2));
}

dumpConfig();
