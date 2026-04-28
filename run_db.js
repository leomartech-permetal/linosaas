const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:psXyvLKVf16wOfCb@db.wnnvkdwbwqxtzuadtqtp.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Conectado ao Supabase!');
    
    const sqlPath = path.join(__dirname, '../database/schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await client.query(sql);
    console.log('Tabelas criadas com sucesso!');
  } catch (err) {
    console.error('Erro na execução:', err);
  } finally {
    await client.end();
  }
}

run();
