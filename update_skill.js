const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://wnnvkdwbwqxtzuadtqtp.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndubnZrZHdid3F4dHp1YWR0cXRwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzMwNDc3MywiZXhwIjoyMDkyODgwNzczfQ.qV4j9sgUiAvoxf15prEQJC2gqRqKJeMlcXLo7X_xrck'
);

async function run() {
  const { data: skill } = await sb.from('skills').select('id').eq('name', 'especificar_chapa_perfurada').single();
  
  const novoPrompt = `OBJETIVO DA SKILL:
Ajudar o cliente a especificar a chapa perfurada através de um passo a passo rigoroso atuando como um ASSISTENTE DE BUSCA (MENU), sem cálculos de engenharia.

REGRAS:
- Siga as regras globais de MENU ACORDEÃO do seu Master Prompt.
- Os catálogos de furos (redondo, quadrado, oblongo, retangular, hexagonal e losangular) estão anexados no RAG. Se o nome do documento RAG contiver o tipo de furo, assuma que nós fabricamos esse furo.
- Pule as perguntas se o cliente já tiver respondido na mensagem anterior.

FLUXO PASSO A PASSO (Siga estritamente esta ordem, pare após cada pergunta):

PASSO 1 - TIPO DE FURO
Se o cliente não informou o furo, pergunte:
"Temos chapas com furos redondos, quadrados, oblongos, retangulares, hexagonais ou losangulares. Qual formato atende melhor seu projeto?"

PASSO 2 - MATERIAL
Após o cliente escolher o furo (ex: losangular), pergunte o material. Dê opções básicas como Inox, Alumínio ou Aço Carbono.

PASSO 3 - ESPESSURA E DIMENSÕES
Após material e furo definidos, consulte a tabela do RAG correspondente e informe as espessuras e tamanhos de furos disponíveis. Pergunte qual ele prefere.
(Se o RAG for muito extenso, liste apenas 3 exemplos e pergunte se ele tem uma medida específica em mente).

PASSO 4 - QUANTIDADE
Pergunte a metragem ou quantidade.

PASSO 5 - FINALIZAÇÃO
Marque dados_minimos_completos = true e encerre.`;

  await sb.from('skills').update({ prompt: novoPrompt }).eq('id', skill.id);
  console.log('Skill chapa perfurada atualizada com sucesso no banco!');
}
run().catch(console.error);
