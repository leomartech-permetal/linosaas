const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:psXyvLKVf16wOfCb@db.wnnvkdwbwqxtzuadtqtp.supabase.co:5432/postgres';

async function run() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Conectado ao Supabase!');
    
    const sqlPath = path.join(__dirname, '../database/migration_qualification_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Executando migração...');
    await client.query(sql);
    console.log('Migração executada com sucesso no Supabase!');
  } catch (err) {
    console.error('Erro na execução:', err);
  } finally {
    await client.end();
  }
}

run();
