const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey) { console.error("Missing keys!"); process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

const RAG_DIR = "C:/Users/MARKETING1/Documents/Projeto_Lino/rag lino/rag_permetal_v2/rag_permetal_v2";

async function generateEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-ada-002",
    input: text.substring(0, 8000),
  });
  return response.data[0].embedding;
}

async function ingestFolder(folderName) {
  const folderPath = path.join(RAG_DIR, folderName);
  if (!fs.existsSync(folderPath)) return;

  console.log(`Processando: ${folderName}`);
  const docName = `Catálogo - ${folderName}`;
  let { data: doc } = await supabase.from('rag_documents').select('id').eq('name', docName).single();
  
  if (!doc) {
    const { data: newDoc } = await supabase.from('rag_documents').insert({ name: docName, active: true }).select('id').single();
    doc = newDoc;
  }

  const files = fs.readdirSync(folderPath);

  for (const file of files) {
    const filePath = path.join(folderPath, file);
    
    if (file.endsWith('.md')) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.trim().length === 0) continue;
      const embedding = await generateEmbedding(content);
      await supabase.from('rag_chunks').insert({
        rag_document_id: doc.id,
        content: `Fonte: ${file}\n\n${content}`,
        metadata: { tipo_arquivo: 'md', arquivo: file },
        ativo_para_filtro: false,
        embedding
      });
      console.log(`  MD Inserido: ${file}`);
    }
    
    if (file.endsWith('.jsonl')) {
      const fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      let batch = [];
      let count = 0;
      for await (const line of rl) {
        if (!line.trim()) continue;
        const json = JSON.parse(line);
        const textContent = `Variante de ${json.categoria}: ` + Object.entries(json).map(([k, v]) => `${k}=${v}`).join(', ');
        
        const embedding = await generateEmbedding(textContent);
        batch.push({
          rag_document_id: doc.id,
          content: textContent,
          metadata: json,
          ativo_para_filtro: json.ativo_para_filtro !== undefined ? json.ativo_para_filtro : true,
          embedding
        });

        if (batch.length >= 50) {
          await supabase.from('rag_chunks').insert(batch);
          count += batch.length;
          batch = [];
          console.log(`  ... ${count} variantes inseridas (${file})`);
        }
      }
      if (batch.length > 0) {
        await supabase.from('rag_chunks').insert(batch);
        count += batch.length;
        console.log(`  ... ${count} variantes inseridas (${file})`);
      }
    }
  }
}

async function main() {
  await ingestFolder('chapa_perfurada');
  await ingestFolder('chapa_expandida');
  await ingestFolder('chapa_recalcada');
  await ingestFolder('metalgrade');
  await ingestFolder('psa');
  await ingestFolder('tela_antiofuscante');
  console.log("Concluido com sucesso!");
}
main();
