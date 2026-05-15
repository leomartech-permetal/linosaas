const { Client } = require('pg');

const connectionString = 'postgresql://postgres:psXyvLKVf16wOfCb@db.wnnvkdwbwqxtzuadtqtp.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Conectado ao projeto wnnvk...');
    
    const res = await client.query('SELECT count(*) FROM leads');
    console.log('Total leads em wnnvk:', res.rows[0].count);

    const config = await client.query('SELECT count(*) FROM tenant_config');
    console.log('Total config em wnnvk:', config.rows[0].count);
    
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    await client.end();
  }
}

run();
