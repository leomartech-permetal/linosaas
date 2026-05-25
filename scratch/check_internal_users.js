const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://wnnvkdwbwqxtzuadtqtp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndubnZrZHdid3F4dHp1YWR0cXRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMwNDc3MywiZXhwIjoyMDkyODgwNzczfQ.qV4j9sgUiAvoxf15prEQJC2gqRqKJeMlcXLo7X_xrck'
);

async function test() {
  const testPhones = [
    '5516997963340@s.whatsapp.net', // Thiago
    '5516997932257@s.whatsapp.net', // Fabio
    '5516991415319@s.whatsapp.net'  // Lead real (Leo)
  ];

  for (const jid of testPhones) {
    const senderPhone = jid.replace(/\D/g, '');
    const { data: internalUser, error } = await sb
      .from('admin_users')
      .select('id, name, whatsapp_number')
      .or(`whatsapp_number.ilike.%${senderPhone}%,whatsapp_number.ilike.%${senderPhone.substring(2)}%`)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(`Erro ao buscar ${jid}:`, error);
    } else {
      console.log(`Jid: ${jid} | Phone: ${senderPhone} | Encontrado:`, internalUser ? `${internalUser.name} (${internalUser.whatsapp_number})` : 'Não (Lead real)');
    }
  }
}

test().catch(console.error);
