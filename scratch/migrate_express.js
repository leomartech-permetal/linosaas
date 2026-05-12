const { Client } = require('pg');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function migrate() {
  const connectionString = "postgresql://postgres.ykgcoatnzmbpltcvouii:permetal2026@aws-0-us-east-1.pooler.supabase.com:6543/postgres";
  
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('Tentando conectar com senha permertal2026...');
    await client.connect();
    console.log('✅ Conectado ao banco!');

    await client.query('ALTER TABLE public.routing_rules ADD COLUMN IF NOT EXISTS is_express BOOLEAN DEFAULT false;');
    console.log('✅ Coluna is_express adicionada com sucesso!');

  } catch (err) {
    console.error('❌ Erro na migração:', err.message);
  } finally {
    await client.end();
  }
}

migrate();
