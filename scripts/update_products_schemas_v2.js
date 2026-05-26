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
    obrigatorias: ["material", "espessura_mm", "quantidade_chapas"],
    opcionais: [
      { campo: "tipo_furo", max_tentativas: 2, descricao: "tipo_furo: redondo | quadrado | hexagonal | oblongo | losangular | retangular" },
      { campo: "diametro_furo_dim1_mm", max_tentativas: 2, descricao: "diâmetro do furo redondo (DIM1) em mm" },
      { campo: "lado_furo_mm", max_tentativas: 2, descricao: "lado do furo quadrado em mm" },
      { campo: "furo_a_mm", max_tentativas: 2, descricao: "furo A (menor dimensão ou largura para retangular/losangular) em mm" },
      { campo: "furo_b_mm", max_tentativas: 2, descricao: "furo B (maior dimensão ou comprimento para retangular/losangular) em mm" },
      { campo: "furo_a_largura_mm", max_tentativas: 2, descricao: "largura do furo oblongo em mm" },
      { campo: "furo_b_comprimento_mm", max_tentativas: 2, descricao: "comprimento do furo oblongo em mm" },
      { campo: "dim1_mm", max_tentativas: 2, descricao: "medida DIM1 do furo hexagonal em mm" },
      { campo: "dim2_mm", max_tentativas: 2, descricao: "medida DIM2 do furo hexagonal em mm" },
      { campo: "entre_centros_ec1_mm", max_tentativas: 2, descricao: "entre-centros EC1 em mm" },
      { campo: "entre_centros_ec2_mm", max_tentativas: 2, descricao: "entre-centros EC2 em mm" },
      { campo: "entre_centros_ec_mm", max_tentativas: 2, descricao: "entre-centros EC em mm" },
      { campo: "area_aberta_percentual", max_tentativas: 1, descricao: "área aberta percentual" },
      { campo: "disposicao", max_tentativas: 1, descricao: "disposição dos furos (AL | RE | DI | AT | ES | nao_sabe)" },
      { campo: "largura_chapa_mm", max_tentativas: 2, descricao: "largura da chapa em mm" },
      { campo: "comprimento_chapa_mm", max_tentativas: 2, descricao: "comprimento da chapa em mm" },
      { campo: "aplicacao", max_tentativas: 2, descricao: "aplicação / finalidade de uso do material" },
      { campo: "acabamento", max_tentativas: 1, descricao: "acabamento ou pintura" },
      { campo: "necessita_corte", max_tentativas: 1, descricao: "necessita de corte (sim | nao | nao_sabe)" },
      { campo: "necessita_dobra", max_tentativas: 1, descricao: "necessita de dobra (sim | nao | nao_sabe)" },
      { campo: "peca_sob_desenho", max_tentativas: 1, descricao: "peça fabricada sob desenho técnico (sim | nao)" },
      { campo: "possui_foto_desenho", max_tentativas: 1, descricao: "cliente possui foto ou desenho para enviar (sim | nao)" }
    ],
    rag_document_name: "rag_furo_redondo.txt"
  },
  "Chapa Expandida": {
    obrigatorias: ["material", "espessura_mm", "quantidade", "aplicacao"],
    opcionais: [
      { campo: "modelo_ou_codigo", max_tentativas: 2, descricao: "modelo ou código da chapa (EXP | GME | nao_sabe)" },
      { campo: "malha", max_tentativas: 2, descricao: "especificação da malha" },
      { campo: "a1_mm", max_tentativas: 2, descricao: "abertura A1 da malha em mm" },
      { campo: "b1_mm", max_tentativas: 2, descricao: "abertura B1 da malha em mm" },
      { campo: "cordao_mm", max_tentativas: 2, descricao: "largura do cordão (passe) em mm" },
      { campo: "largura_mm", max_tentativas: 2, descricao: "largura da chapa em mm" },
      { campo: "comprimento_mm", max_tentativas: 2, descricao: "comprimento da chapa em mm" },
      { campo: "formato_fornecimento", max_tentativas: 2, descricao: "formato (chapa | rolo | peca_cortada)" },
      { campo: "acabamento", max_tentativas: 1, descricao: "acabamento (normal | galvanizado | pintado | outro)" },
      { campo: "necessita_corte", max_tentativas: 1, descricao: "corte (sim | nao | nao_sabe)" },
      { campo: "necessita_dobra", max_tentativas: 1, descricao: "dobra (sim | nao | nao_sabe)" },
      { campo: "necessita_fixacao", max_tentativas: 1, descricao: "necessita de fixação (sim | nao | nao_sabe)" },
      { campo: "aplicacao_critica", max_tentativas: 2, descricao: "uso em aplicação crítica como carga, passarela ou piso (piso | passarela | plataforma | carga | seguranca | nao)" },
      { campo: "possui_foto_desenho_projeto", max_tentativas: 1, descricao: "possui foto, desenho ou projeto (sim | nao)" }
    ],
    rag_document_name: "rag_completo_chapa_expandida_permetal.txt"
  },
  "Tela Expandida": {
    obrigatorias: ["material", "comprimento_rolo_mm", "largura_rolo_mm", "espessura_mm", "malha_a_mm", "malha_b_mm", "cordao_mm", "quantidade_rolos"],
    opcionais: [
      { campo: "acabamento", max_tentativas: 1, descricao: "acabamento (normal | laminado | outro)" },
      { campo: "aplicacao", max_tentativas: 2, descricao: "aplicação da tela" }
    ],
    rag_document_name: "tela_expandida_rolo"
  },
  "Portao Gradil": {
    obrigatorias: ["tipo_portao", "modelo_gradil", "largura_total_mm", "altura_mm", "quantidade"],
    opcionais: [
      { campo: "quantidade_folhas", max_tentativas: 1, descricao: "quantidade de folhas (abrir, correr, etc.)" },
      { campo: "acabamento", max_tentativas: 2, descricao: "acabamento (bruto | galvanizado_a_fogo | pintura_eletrostatica)" },
      { campo: "cor", max_tentativas: 2, descricao: "cor do portão" },
      { campo: "com_automatizacao", max_tentativas: 1, descricao: "com automatização/motor (sim | nao | nao_sabe)" },
      { campo: "lado_abertura", max_tentativas: 1, descricao: "lado de abertura (direita | esquerda | nao_sabe)" },
      { campo: "local_instalacao", max_tentativas: 2, descricao: "local de instalação" },
      { campo: "possui_pilares_ou_vao_pronto", max_tentativas: 1, descricao: "possui pilares ou vão pronto para instalação (sim | nao | nao_sabe)" }
    ],
    rag_document_name: "portão_gradil"
  },
  "Gradil Metalico": {
    obrigatorias: ["modelo", "altura_painel_mm", "comprimento_linear_m", "acabamento", "cor", "tipo_instalacao"],
    opcionais: [
      { campo: "malha_a_mm", max_tentativas: 2, descricao: "medida da malha A em mm" },
      { campo: "malha_b_mm", max_tentativas: 2, descricao: "medida da malha B em mm" },
      { campo: "fio_horizontal_mm", max_tentativas: 2, descricao: "medida do fio horizontal em mm" },
      { campo: "pilar_secao", max_tentativas: 2, descricao: "seção do pilar (60x40 | 60x60 | 120x60x3,0 | 76x8 | outro)" },
      { campo: "largura_painel_mm", max_tentativas: 2, descricao: "largura padrão do painel (geralmente 2500 mm)" },
      { campo: "quantidade_paineis", max_tentativas: 2, descricao: "quantidade de painéis" },
      { campo: "quantidade_pilares", max_tentativas: 2, descricao: "quantidade de pilares" },
      { campo: "necessita_acessorios_fixadores", max_tentativas: 1, descricao: "necessita acessórios de fixação (sim | nao | nao_sabe)" }
    ],
    rag_document_name: "gradis_metalgrade"
  },
  "Piso Industrial": {
    obrigatorias: ["tipo_piso", "material", "comprimento_mm", "largura_mm", "espessura_mm", "quantidade"],
    opcionais: [
      { campo: "malha_ou_relevo", max_tentativas: 2, descricao: "especificação da malha ou relevo do piso" },
      { campo: "cordao_mm", max_tentativas: 2, descricao: "largura do cordão em mm" },
      { campo: "vao_livre_mm", max_tentativas: 2, descricao: "vão livre entre apoios em mm" },
      { campo: "carga_prevista", max_tentativas: 2, descricao: "carga de peso prevista sobre o piso" },
      { campo: "tipo_trafego", max_tentativas: 2, descricao: "tipo de tráfego (pessoas | carrinho | empilhadeira | veiculo | nao_sabe)" },
      { campo: "ambiente", max_tentativas: 1, descricao: "ambiente de instalação (interno | externo | umido | oleoso | agressivo)" },
      { campo: "acabamento", max_tentativas: 1, descricao: "acabamento (natural | galvanizado | pintado)" },
      { campo: "validacao_engenharia", max_tentativas: 1, descricao: "validação obrigatória pela engenharia (obrigatoria)" }
    ],
    rag_document_name: "chapa recalcada"
  },
  "Grade de Piso": {
    obrigatorias: ["tipo_grade", "material", "comprimento_mm", "largura_mm", "quantidade"],
    opcionais: [
      { campo: "altura_barra_portante_mm", max_tentativas: 2, descricao: "altura da barra portante em mm" },
      { campo: "espessura_barra_portante_mm", max_tentativas: 2, descricao: "espessura da barra portante em mm" },
      { campo: "malha_mm", max_tentativas: 2, descricao: "tamanho da malha em mm" },
      { campo: "vao_livre_mm", max_tentativas: 2, descricao: "vão livre em mm" },
      { campo: "carga_prevista", max_tentativas: 2, descricao: "carga prevista sobre a grade" },
      { campo: "tipo_trafego", max_tentativas: 2, descricao: "tipo de tráfego (pessoas | carrinho | empilhadeira | veiculo | nao_sabe)" },
      { campo: "acabamento", max_tentativas: 1, descricao: "acabamento (natural | galvanizado_a_fogo | pintado)" },
      { campo: "necessita_recorte", max_tentativas: 1, descricao: "recortes sob medida (sim | nao | nao_sabe)" },
      { campo: "necessita_fixador", max_tentativas: 1, descricao: "necessita de fixadores (sim | nao | nao_sabe)" }
    ],
    rag_document_name: "gradis_metalgrade"
  },
  "Degrau em Grade de Piso": {
    obrigatorias: ["tipo_degrau", "material", "largura_mm", "profundidade_mm", "quantidade"],
    opcionais: [
      { campo: "altura_barra_portante_mm", max_tentativas: 2, descricao: "altura da barra portante em mm" },
      { campo: "espessura_barra_portante_mm", max_tentativas: 2, descricao: "espessura da barra portante em mm" },
      { campo: "malha_mm", max_tentativas: 2, descricao: "tamanho da malha em mm" },
      { campo: "com_espelho_antiderrapante", max_tentativas: 1, descricao: "com espelho/anteparo antiderrapante (sim | nao | nao_sabe)" },
      { campo: "furo_lateral_ou_fixacao", max_tentativas: 1, descricao: "furos laterais de fixação nas abas (sim | nao | nao_sabe)" },
      { campo: "acabamento", max_tentativas: 1, descricao: "acabamento (natural | galvanizado_a_fogo | pintado)" },
      { campo: "aplicacao", max_tentativas: 2, descricao: "aplicação (escada_industrial | plataforma | mezanino | acesso_tecnico)" }
    ],
    rag_document_name: "gradis_metalgrade"
  },
  "Forro Metalico": {
    obrigatorias: ["material", "comprimento_mm", "largura_mm", "altura_mm", "espessura_mm", "modelo", "tipo_furo", "acabamento", "area_m2", "quantidade"],
    opcionais: [
      { campo: "especificacao_furo", max_tentativas: 2, descricao: "especificação do furo" },
      { campo: "entre_centro", max_tentativas: 2, descricao: "entre-centros / espaçamento do furo" },
      { campo: "tipo_forro", max_tentativas: 1, descricao: "tipo de forro (J | outro)" },
      { campo: "aplicacao", max_tentativas: 2, descricao: "local de aplicação do forro" }
    ],
    rag_document_name: "tabela_forros_corrigida"
  },
  "Brise Metalico": {
    obrigatorias: ["modelo_brise", "material", "espessura_mm", "cordao_mm", "area_m2", "acabamento", "aplicacao"],
    opcionais: [
      { campo: "malha_a_mm", max_tentativas: 2, descricao: "malha A do brise expandido" },
      { campo: "malha_b_mm", max_tentativas: 2, descricao: "malha B do brise expandido" },
      { campo: "formato_chapa", max_tentativas: 2, descricao: "formato da chapa (1000x2000 | outro)" },
      { campo: "possui_projeto", max_tentativas: 1, descricao: "possui projeto técnico de fixação (sim | nao)" },
      { campo: "observacao_tecnica", max_tentativas: 2, descricao: "observações técnicas e restrições de fabricação" }
    ],
    rag_document_name: "brise_expandido"
  },
  "Tela Antiofuscante": {
    obrigatorias: ["modelo", "altura_mm", "comprimento_linear_m", "tipo_fixacao", "aplicacao", "possui_projeto", "quantidade"],
    opcionais: [
      { campo: "material", max_tentativas: 1, descricao: "material da tela (geralmente aco_galvanizado)" },
      { campo: "malha_a_mm", max_tentativas: 2, descricao: "malha A em mm" },
      { campo: "malha_b_mm", max_tentativas: 2, descricao: "malha B em mm" },
      { campo: "cordao_mm", max_tentativas: 2, descricao: "largura do cordão do metal expandido em mm" },
      { campo: "esp_b_mm", max_tentativas: 2, descricao: "espessura B em mm" },
      { campo: "esp_c_mm", max_tentativas: 2, descricao: "espessura C em mm" },
      { campo: "angulo_malha_maior_20_graus", max_tentativas: 1, descricao: "ângulo da malha maior de 20 graus (sim | nao | nao_sabe)" }
    ],
    rag_document_name: "tela antiofuscante"
  },
  "Fachada Metalica": {
    obrigatorias: ["sistema_fachada", "material", "area_total_m2"],
    opcionais: [
      { campo: "modulacao_pecas", max_tentativas: 2, descricao: "modulação das peças" },
      { campo: "comprimento_peca_mm", max_tentativas: 2, descricao: "comprimento da peça em mm" },
      { campo: "largura_peca_mm", max_tentativas: 2, descricao: "largura da peça em mm" },
      { campo: "espessura_mm", max_tentativas: 2, descricao: "espessura da chapa em mm" },
      { campo: "malha_ou_furo", max_tentativas: 2, descricao: "modelo de malha ou tipo de furo" },
      { campo: "cordao_ou_entre_centro", max_tentativas: 2, descricao: "passe do cordão ou entre-centros em mm" },
      { campo: "area_aberta_percentual", max_tentativas: 1, descricao: "área aberta percentual" },
      { campo: "acabamento", max_tentativas: 1, descricao: "acabamento (natural | galvanizado | pintado | anodizado | outro)" },
      { campo: "cor", max_tentativas: 1, descricao: "cor desejada" },
      { campo: "tipo_fixacao", max_tentativas: 2, descricao: "tipo de fixação na fachada" },
      { campo: "possui_projeto", max_tentativas: 1, descricao: "possui projeto executivo (sim | nao)" },
      { campo: "aplicacao", max_tentativas: 2, descricao: "aplicação (estetica | ventilacao | sombreamento | fechamento)" }
    ],
    rag_document_name: "faq_chapas_perfuradas_lino_atualizado.txt"
  },
  "Painel Perfurado / Brise Artemis": {
    obrigatorias: ["tipo", "material", "quantidade"],
    opcionais: [
      { campo: "comprimento_mm", max_tentativas: 2, descricao: "comprimento do painel em mm" },
      { campo: "largura_mm", max_tentativas: 2, descricao: "largura do painel em mm" },
      { campo: "espessura_mm", max_tentativas: 2, descricao: "espessura da chapa em mm" },
      { campo: "tipo_furo_ou_malha", max_tentativas: 2, descricao: "tipo de furo ou malha perfurada" },
      { campo: "dimensao_furo_ou_malha_mm", max_tentativas: 2, descricao: "dimensão do furo ou malha em mm" },
      { campo: "entre_centro_ou_cordao_mm", max_tentativas: 2, descricao: "entre-centros ou cordão do painel" },
      { campo: "area_aberta_percentual", max_tentativas: 1, descricao: "área aberta percentual do painel" },
      { campo: "acabamento", max_tentativas: 1, descricao: "acabamento (natural | galvanizado | pintado | anodizado | outro)" },
      { campo: "cor", max_tentativas: 1, descricao: "cor do revestimento" },
      { campo: "aplicacao", max_tentativas: 2, descricao: "finalidade (fachada | brise | ventilacao | decorativo | privacidade)" },
      { campo: "possui_projeto", max_tentativas: 1, descricao: "possui projeto técnico (sim | nao)" }
    ],
    rag_document_name: "faq_chapas_perfuradas_lino_atualizado.txt"
  },
  "Bobina Moeda / Belinox": {
    obrigatorias: ["material", "quantidade"],
    opcionais: [
      { campo: "formato", max_tentativas: 1, descricao: "formato (bobina | chapa | rolo)" },
      { campo: "espessura_mm", max_tentativas: 2, descricao: "espessura em mm" },
      { campo: "largura_mm", max_tentativas: 2, descricao: "largura em mm" },
      { campo: "comprimento_ou_metragem", max_tentativas: 2, descricao: "comprimento / metragem desejada" },
      { campo: "tipo_estampa_ou_moeda", max_tentativas: 2, descricao: "tipo de estampa/desenho moeda" },
      { campo: "acabamento", max_tentativas: 1, descricao: "acabamento (natural | polido | escovado | galvanizado | pintado | outro)" },
      { campo: "aplicacao", max_tentativas: 2, descricao: "finalidade de uso" },
      { campo: "possui_foto_amostra", max_tentativas: 1, descricao: "possui foto ou amostra da tela moeda (sim | nao)" }
    ],
    rag_document_name: "faq_chapas_perfuradas_lino_atualizado.txt"
  },
  "Chapa Recalcada": {
    obrigatorias: ["forma_recalque", "material", "espessura_mm", "quantidade_chapas", "aplicacao"],
    opcionais: [
      { campo: "codigo_recalque", max_tentativas: 2, descricao: "código do modelo de recalque" },
      { campo: "variante", max_tentativas: 2, descricao: "variante do recalque" },
      { campo: "dim_a_mm", max_tentativas: 2, descricao: "medida A do relevo em mm" },
      { campo: "dim_b_mm", max_tentativas: 2, descricao: "medida B do relevo em mm" },
      { campo: "entre_centros_ec_mm", max_tentativas: 2, descricao: "espaçamento entre-centros em mm" },
      { campo: "area_aberta_percentual", max_tentativas: 1, descricao: "área aberta percentual" },
      { campo: "largura_chapa_mm", max_tentativas: 2, descricao: "largura da chapa em mm" },
      { campo: "comprimento_chapa_mm", max_tentativas: 2, descricao: "comprimento da chapa em mm" },
      { campo: "acabamento", max_tentativas: 1, descricao: "acabamento ou pintura" }
    ],
    rag_document_name: "chapa recalcada"
  }
};

async function runSeed() {
  try {
    const { data: products, error: pError } = await supabase.from('products').select('id, name');
    if (pError) throw pError;

    console.log(`Encontrados ${products.length} produtos no banco. Atualizando para os novos schemas estruturados (v2)...`);

    for (const prod of products) {
      const matchingKey = Object.keys(schemas).find(k => 
        prod.name.toLowerCase().includes(k.toLowerCase()) || 
        k.toLowerCase().includes(prod.name.toLowerCase())
      );

      if (matchingKey) {
        const schema = schemas[matchingKey];
        console.log(`-> Atualizando "${prod.name}" (ID: ${prod.id}) com o schema v2 de "${matchingKey}"`);
        const { error: updateError } = await supabase
          .from('products')
          .update({ qualification_schema: schema })
          .eq('id', prod.id);

        if (updateError) {
          console.error(`Erro ao atualizar ${prod.name}:`, updateError);
        }
      } else {
        const defaultSchema = {
          obrigatorias: ["material", "quantidade"],
          opcionais: [
            { campo: "dimensoes", max_tentativas: 2, descricao: "Medidas ou especificações de dimensões" }
          ]
        };
        console.log(`-> Produto "${prod.name}" sem correspondente direto. Aplicando padrão.`);
        await supabase.from('products').update({ qualification_schema: defaultSchema }).eq('id', prod.id);
      }
    }

    console.log('=== SEED V2 CONCLUÍDO COM SUCESSO ===');
  } catch (err) {
    console.error('Falha geral no seed v2:', err);
  }
}

runSeed();
