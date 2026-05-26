const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    env[match[1]] = (match[2] || '').trim().replace(/^"|"$/g, '');
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const schemas = {
  "Chapa Perfurada": {
    obrigatorias: ["material", "espessura", "quantidade"],
    opcionais: [
      { campo: "tipo_furo", max_tentativas: 2, descricao: "Tipo de furo (redondo, quadrado, oblongo, hexagonal, retangular ou losangular)" },
      { campo: "dimensoes", max_tentativas: 2, descricao: "Medida do furo em mm (diâmetro para redondo, lado para quadrado, A x B para outros)" },
      { campo: "ec", max_tentativas: 2, descricao: "Entre-centros em mm (espaçamento centro a centro dos furos)" },
      { campo: "disposicao", max_tentativas: 1, descricao: "Disposição dos furos (AL - Alternada, RE - Reta, DI - Diagonal, etc.)" }
    ],
    rag_document_name: "rag_furo_redondo.txt"
  },
  "Chapa Expandida": {
    obrigatorias: ["material", "espessura", "quantidade"],
    opcionais: [
      { campo: "malha", max_tentativas: 2, descricao: "Medida da malha A x B em mm (abertura da malha, ex: 10x20 mm)" },
      { campo: "cordao", max_tentativas: 2, descricao: "Largura do cordão (passe) em mm" },
      { campo: "dimensoes_placa", max_tentativas: 2, descricao: "Dimensões da placa (largura x comprimento)" }
    ],
    rag_document_name: "rag_completo_chapa_expandida_permetal.txt"
  },
  "Tela Expandida": {
    obrigatorias: ["material", "espessura", "quantidade"],
    opcionais: [
      { campo: "malha", max_tentativas: 2, descricao: "Medida da malha A x B em mm (abertura da malha, ex: 3x6 mm)" },
      { campo: "cordao", max_tentativas: 1, descricao: "Largura do cordão (passe) em mm" },
      { campo: "dimensoes_placa", max_tentativas: 2, descricao: "Dimensões do rolo/placa (largura x comprimento)" }
    ],
    rag_document_name: "tela_expandida_rolo"
  },
  "Portao Gradil": {
    obrigatorias: ["modelo_gradil", "tipo_portao", "altura", "quantidade"],
    opcionais: [
      { campo: "largura_vao", max_tentativas: 2, descricao: "Largura do vão ou portão em mm" },
      { campo: "acabamento", max_tentativas: 2, descricao: "Acabamento (galvanizado a fogo ou pintura eletrostática/epóxi)" }
    ],
    rag_document_name: "portão_gradil"
  },
  "Piso Industrial": {
    obrigatorias: ["material", "espessura", "quantidade"],
    opcionais: [
      { campo: "forma_recalque", max_tentativas: 2, descricao: "Formato do relevo/recalque (quadrado, oblongo, redondo, modelo GME)" },
      { campo: "dimensoes_recalque", max_tentativas: 2, descricao: "Medidas do relevo em mm" },
      { campo: "dimensoes_placa", max_tentativas: 2, descricao: "Dimensões da placa (comprimento x largura)" }
    ],
    rag_document_name: "chapa recalcada"
  },
  "Forro Metalico": {
    obrigatorias: ["modelo_forro", "material", "quantidade"],
    opcionais: [
      { campo: "dimensoes_forro", max_tentativas: 2, descricao: "Medidas das colmeias, réguas ou placas (comprimento x largura x altura)" },
      { campo: "espessura", max_tentativas: 2, descricao: "Espessura da chapa em mm" },
      { campo: "tipo_furo", max_tentativas: 1, descricao: "Se o forro é perfurado ou liso" },
      { campo: "acabamento", max_tentativas: 1, descricao: "Pintura ou acabamento superficial" }
    ],
    rag_document_name: "tabela_forros_corrigida"
  },
  "Brise Metalico": {
    obrigatorias: ["modelo_brise", "material", "quantidade"],
    opcionais: [
      { campo: "dimensoes", max_tentativas: 2, descricao: "Largura das lâminas ou espaçamento do brise" },
      { campo: "acabamento", max_tentativas: 2, descricao: "Pintura ou acabamento" }
    ],
    rag_document_name: "brise_expandido"
  },
  "Tela Antiofuscante": {
    obrigatorias: ["modelo_antiofuscante", "material", "quantidade"],
    opcionais: [
      { campo: "malha", max_tentativas: 2, descricao: "Medidas da malha A x B em mm" },
      { campo: "espessura_cordao", max_tentativas: 2, descricao: "Espessura e largura do cordão do metal expandido" }
    ],
    rag_document_name: "tela antiofuscante"
  },
  "Grade de Piso": {
    obrigatorias: ["material", "quantidade"],
    opcionais: [
      { campo: "modelo_grade", max_tentativas: 2, descricao: "Modelo ou tipo de malha (estrado, eletrofundido, serrilhado, liso)" },
      { campo: "largura_comprimento", max_tentativas: 2, descricao: "Comprimento x largura dos painéis em mm" },
      { campo: "acabamento", max_tentativas: 1, descricao: "Galvanização ou pintura" }
    ],
    rag_document_name: "gradis_metalgrade"
  },
  "Bobina Moeda / Belinox": {
    obrigatorias: ["material", "quantidade"],
    opcionais: [
      { campo: "dimensoes", max_tentativas: 2, descricao: "Medidas da bobina (largura x comprimento ou diâmetro do furo)" }
    ],
    rag_document_name: "faq_chapas_perfuradas_lino_atualizado.txt"
  },
  "Painel Perfurado / Brise Artemis": {
    obrigatorias: ["material", "quantidade"],
    opcionais: [
      { campo: "dimensoes", max_tentativas: 2, descricao: "Medidas de comprimento x largura x espessura em mm" }
    ],
    rag_document_name: "faq_chapas_perfuradas_lino_atualizado.txt"
  }
};

async function runSeed() {
  try {
    const { data: products, error: pError } = await supabase.from('products').select('id, name');
    if (pError) throw pError;

    console.log(`Encontrados ${products.length} produtos no banco de dados. Atualizando schemas...`);

    for (const prod of products) {
      // Tentar achar um schema para o produto (case-insensitive e busca por substring)
      const matchingKey = Object.keys(schemas).find(k => 
        prod.name.toLowerCase().includes(k.toLowerCase()) || 
        k.toLowerCase().includes(prod.name.toLowerCase())
      );

      if (matchingKey) {
        const schema = schemas[matchingKey];
        console.log(`-> Atualizando "${prod.name}" (ID: ${prod.id}) com o schema de "${matchingKey}"`);
        const { error: updateError } = await supabase
          .from('products')
          .update({ qualification_schema: schema })
          .eq('id', prod.id);

        if (updateError) {
          console.error(`Erro ao atualizar ${prod.name}:`, updateError);
        }
      } else {
        // Fallback schema padrão para produtos sem mapeamento explícito
        const defaultSchema = {
          obrigatorias: ["material", "quantidade"],
          opcionais: [
            { campo: "dimensoes", max_tentativas: 2, descricao: "Medidas ou especificações de dimensões" }
          ]
        };
        console.log(`-> Produto "${prod.name}" sem schema mapeado. Aplicando padrão.`);
        await supabase.from('products').update({ qualification_schema: defaultSchema }).eq('id', prod.id);
      }
    }

    console.log('=== SEED CONCLUÍDO COM SUCESSO ===');
  } catch (err) {
    console.error('Falha geral no seed:', err);
  }
}

runSeed();
