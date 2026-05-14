import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ykgcoatnzmbpltcvouii.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlrZ2NvYXRuem1icGx0Y3ZvdWlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA4MTE5OSwiZXhwIjoyMDkzNjU3MTk5fQ.T9IgY0uqwLpd-5eRs55UZZ0wxC4t6Y9tgOE3NRgrpLI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: leads, error } = await supabase.from('leads').select('*').in('whatsapp_number', ['16991415319', '5516991415319', '16991415319@s.whatsapp.net', '5516991415319@s.whatsapp.net']);
  console.log('Leads Error:', error);
  console.log('Leads:', leads?.map(l => ({ id: l.id, status: l.status, bot_active: l.bot_active, number: l.whatsapp_number })));

  for (const lead of leads || []) {
    const { data: interactions } = await supabase.from('interactions').select('id, sender_type, message_content').eq('lead_id', lead.id);
    console.log(`Interactions for ${lead.whatsapp_number}:`, interactions);
  }
}

main().catch(console.error);
