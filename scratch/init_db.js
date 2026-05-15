const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Tentando a senha encontrada no outro script
const connectionString = 'postgresql://postgres.ykgcoatnzmbpltcvouii:permetal2026@aws-0-us-east-1.pooler.supabase.com:6543/postgres';

async function run() {
  console.log('Tentando conectar ao banco ykgcoat...');
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('✅ Conectado ao Supabase!');
    
    const sqlPath = path.join(__dirname, '../setup_tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Executando setup_tables.sql...');
    await client.query(sql);
    console.log('✅ Tabelas criadas com sucesso!');

    // Também executar o schema.sql se necessário
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    if (fs.existsSync(schemaPath)) {
        console.log('Executando schema.sql...');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await client.query(schemaSql);
        console.log('✅ Schema principal aplicado!');
    }

  } catch (err) {
    console.error('❌ Erro na execução:', err.message);
  } finally {
    await client.end();
  }
}

run();
