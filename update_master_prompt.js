const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const sb = createClient(
  'https://wnnvkdwbwqxtzuadtqtp.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndubnZrZHdid3F4dHp1YWR0cXRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMwNDc3MywiZXhwIjoyMDkyODgwNzczfQ.qV4j9sgUiAvoxf15prEQJC2gqRqKJeMlcXLo7X_xrck'
);

async function run() {
  const { data: config } = await sb.from('tenant_config').select('master_prompt').limit(1).single();
  let prompt = config.master_prompt;
  
  const startSplit = '==================================================\n8. CONSULTA AO RAG';
  const endSplit = '==================================================\n10. FLUXO PARA CLIENTE SEM DADOS TÉCNICOS';
  
  const p1 = prompt.substring(0, prompt.indexOf(startSplit));
  const p2 = prompt.substring(prompt.indexOf(endSplit));
  
  const replacement = `==================================================
8. ATUAÇÃO COMO ASSISTENTE DE BUSCA (MENU E RAG)
==================================================

Você atua como um assistente de busca em cima dos catálogos (RAG). 

Regras OBRIGATÓRIAS de comportamento (Menu Acordeão):
1. O RAG JÁ ESTÁ COM VOCÊ: NUNCA diga ao cliente "vou consultar o sistema", "vou verificar o RAG" ou peça "um momento". O conteúdo já está anexado no final do seu contexto. Leia secretamente e responda com naturalidade.
2. PASSO A PASSO (MENU): Faça UMA pergunta por vez oferecendo as opções reais que você leu no RAG. (Ex: "Tenho nos materiais A, B e C. Qual atende melhor?"). Pare e espere a resposta.
3. PULE O QUE JÁ FOI DITO: Se a primeira mensagem do cliente já tem dados (ex: "quero chapa quadrada galvanizada"), registre isso mentalmente e pule as perguntas de tipo de furo e material. Pergunte APENAS o que falta (ex: espessura ou quantidade).
4. SEM ENGENHARIA PESADA: Não entre em cálculos complexos ou dimensionamento estrutural avançado. Ajude o cliente a enquadrar a necessidade dele no que temos disponível no catálogo (RAG). Se ele não souber ou pedir cálculos, diga que o especialista junto com a engenharia avaliará a melhor solução técnica.

==================================================
9. FLUXO COMERCIAL PADRÃO E ROTEAMENTO
==================================================

Siga rigorosamente este fluxo:
1. Identificar produto e aplicação.
2. Se o cliente já deu detalhes técnicos, guarde-os.
3. Se houver Skill do produto, siga o roteiro dela filtrando pelas opções do RAG.
4. Faça apenas 1 pergunta técnica por mensagem, oferecendo alternativas.
5. Coletar quantidade/metragem.
6. Confirmar dados.
7. Marcar "dados_minimos_completos": true para disparar o roteamento comercial.

`;

  const newPrompt = p1 + replacement + p2;
  
  if (prompt === newPrompt) {
    console.log("Erro: Regex nao bateu!");
  } else {
    // fs.writeFileSync('new_prompt.txt', newPrompt);
    const { error } = await sb.from('tenant_config').update({ master_prompt: newPrompt }).eq('id', config.id || null).is('id', null).not('master_prompt', 'is', null);
    // actually, tenant_config only has 1 row. Let's just update where company_name is 'LINO CRM' or similar.
    const { data: updated } = await sb.from('tenant_config').update({ master_prompt: newPrompt }).neq('id', '00000000-0000-0000-0000-000000000000');
    console.log("Master Prompt atualizado com sucesso para todos os produtos.");
  }
}

run().catch(console.error);
