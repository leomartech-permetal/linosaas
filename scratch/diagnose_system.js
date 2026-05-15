const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ykgcoatnzmbpltcvouii.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZ2NvYXRuem1icGx0Y3ZvdWlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA4MTE5OSwiZXhwIjoyMDkzNjU3MTk5fQ.T9IgY0uqwLpd-5eRs55UZZ0wxC4t6Y9tgOE3NRgrpLI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('--- LINO SYSTEM DIAGNOSIS ---');
  
  // 1. Supabase Connection
  console.log('Checking Supabase connection...');
  const { data: leadsCount, error: leadsError } = await supabase.from('leads').select('*', { count: 'exact', head: true });
  if (leadsError) {
    console.error('❌ Supabase error:', leadsError);
  } else {
    console.log('✅ Supabase connected. Total leads:', leadsCount);
  }

  // 2. Global Bot Status
  console.log('Checking Global Bot Status...');
  const { data: config, error: configError } = await supabase.from('tenant_config').select('*').limit(1).single();
  if (configError) {
    console.error('❌ Tenant config error:', configError.message);
  } else {
    console.log('✅ Global bot_active:', config.bot_active);
    console.log('✅ Tenant Name:', config.name);
  }

  // 3. Evolution API Instances
  console.log('Checking Evolution API Instances...');
  const { data: instances, error: instancesError } = await supabase.from('instances').select('*');
  if (instancesError) {
    console.error('❌ Instances table error:', instancesError.message);
  } else {
    console.log(`✅ Found ${instances?.length || 0} instances.`);
    instances?.forEach(inst => {
      console.log(` - Instance ${inst.id}: ${inst.active ? 'ACTIVE' : 'INACTIVE'} (${inst.phone_number || 'no phone'})`);
    });
  }

  // 4. Recent Interactions
  console.log('Checking Recent Interactions (last 1h)...');
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const { data: recentMsgs, error: msgsError } = await supabase
    .from('interactions')
    .select('id, created_at, sender_type')
    .gte('created_at', oneHourAgo)
    .order('created_at', { ascending: false });
    
  if (msgsError) {
    console.error('❌ Interactions error:', msgsError.message);
  } else {
    console.log(`✅ Found ${recentMsgs?.length || 0} messages in the last hour.`);
  }

  // 5. OpenAI Check (Optional/Simple)
  console.log('Checking OpenAI Key Presence...');
  if (process.env.OPENAI_API_KEY) {
    console.log('✅ OpenAI API Key is configured.');
  } else {
    console.warn('⚠️ OpenAI API Key is MISSING.');
  }

  console.log('--- DIAGNOSIS COMPLETE ---');
}

diagnose().catch(console.error);
