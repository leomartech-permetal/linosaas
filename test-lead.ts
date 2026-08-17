import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function run() {
  const num = '16991415319';
  console.log(`Buscando lead com número: ${num}`);
  
  const { data: leads, error: leadError } = await supabase
    .from('leads')
    .select('id, name, status, updated_at, whatsapp_number')
    .like('whatsapp_number', `%${num}%`);
  
  console.log('Leads encontrados:', leads, leadError ? `Erro: ${leadError.message}` : '');
  
  if (leads && leads.length > 0) {
    for (const lead of leads) {
      console.log(`\nInterações para o lead ${lead.id} (${lead.whatsapp_number}):`);
      const { data: interactions, error: intError } = await supabase
        .from('interactions')
        .select('id, message_content, created_at, sender_type')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false })
        .limit(5);
      console.log(interactions, intError ? `Erro: ${intError.message}` : '');
    }
  }

  console.log('\nChecando a tabela webhook_logs por entradas recentes...');
  const { data: webhooks, error: whError } = await supabase
    .from('webhook_logs')
    .select('id, created_at, payload')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (whError) {
    console.log('Sem tabela webhook_logs ou deu erro:', whError.message);
  } else {
    webhooks?.forEach(w => {
      console.log(`\n- Webhook ${w.created_at} | ID: ${w.id}`);
      const pl = typeof w.payload === 'string' ? JSON.parse(w.payload) : w.payload;
      console.log(`  Source/Data:`, JSON.stringify(pl).substring(0, 100));
    });
  }
}
run();
