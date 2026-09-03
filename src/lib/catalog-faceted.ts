import { supabaseServer as supabase } from './supabase-server';

export interface FacetFilterCriteria {
  familia?: string;
  modelo?: string;
  categoria?: string;
  malha_a?: number;
  malha_b?: number;
  material?: string;
  espessura?: number;
}

export interface CatalogFacetResult {
  familia?: string;
  modelo?: string;
  modelos_disponiveis: string[];
  malhas_disponiveis: { malha_a?: number; malha_b?: number; label: string }[];
  alturas_disponiveis: number[];
  larguras_disponiveis: number[];
  acabamentos_disponiveis: string[];
  arames_disponiveis: number[];
  materiais_disponiveis: { key: string; label: string }[];
  espessuras_disponiveis: number[];
  variantes_exatas: any[];
  total_encontradas: number;
}

/**
 * Normaliza termos de material para a chave padrão do banco
 */
export function normalizeMaterial(term: string): string | null {
  const t = term.toLowerCase();
  if (t.includes('inox') || t.includes('inoxidavel')) return 'aco_inox';
  if (t.includes('aluminio') || t.includes('alumínio')) return 'aluminio';
  if (t.includes('carbono') || t.includes('sae') || t.includes('preta')) return 'aco_carbono';
  if (t.includes('galvanizad')) return 'aco_galvanizado';
  return null;
}

/**
 * Extrai atributos técnicos a partir de um texto ou descrição de imagem
 */
export function extractTechnicalAttributes(text: string) {
  const clean = text.toLowerCase();
  const attributes: {
    familia?: string;
    modelo?: string;
    categoria?: string;
    malha_a?: number;
    malha_b?: number;
    material?: string;
    espessura?: number;
    dimensoes?: string;
    quantidade?: string;
  } = {};

  // Família
  if (clean.includes('expandid') || clean.includes('exp -') || clean.includes('exp-')) {
    attributes.familia = 'chapa_expandida';
  } else if (clean.includes('perfurad') || clean.includes('furo ')) {
    attributes.familia = 'chapa_perfurada';
  } else if (clean.includes('recalcad')) {
    attributes.familia = 'chapa_recalcada';
  } else if (clean.includes('gradil') || clean.includes('grade de piso')) {
    attributes.familia = 'gradil';
  } else if (clean.includes('brise')) {
    attributes.familia = 'brise_metalico';
  }

  // Modelos específicos (Gradil / Telas)
  if (clean.includes('stadium')) {
    attributes.modelo = 'stadium';
    if (!attributes.familia) attributes.familia = 'gradil';
  } else if (clean.includes('artis')) {
    attributes.modelo = 'artis';
    if (!attributes.familia) attributes.familia = 'gradil';
  } else if (clean.includes('sigma')) {
    attributes.modelo = 'sigma';
    if (!attributes.familia) attributes.familia = 'gradil';
  } else if (clean.includes('omega')) {
    attributes.modelo = 'omega';
    if (!attributes.familia) attributes.familia = 'gradil';
  } else if (clean.includes('leone')) {
    attributes.modelo = 'leone';
    if (!attributes.familia) attributes.familia = 'gradil';
  } else if (clean.includes('parque')) {
    attributes.modelo = 'parque';
    if (!attributes.familia) attributes.familia = 'gradil';
  }

  // Malha / AxB (ex: 50x200, 20x50, 20 x 50, AxB 20x50)
  const malhaMatch = clean.match(/(?:axb\s*)?(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)/i);
  if (malhaMatch) {
    const v1 = parseFloat(malhaMatch[1].replace(',', '.'));
    const v2 = parseFloat(malhaMatch[2].replace(',', '.'));
    attributes.malha_a = Math.min(v1, v2);
    attributes.malha_b = Math.max(v1, v2);
  }

  // Material
  const mat = normalizeMaterial(clean);
  if (mat) attributes.material = mat;

  // Espessura (ex: 1.5mm, 1,5 mm, #16, #14)
  const espMatch = clean.match(/(\d+(?:[.,]\d+)?)\s*(?:mm|milimetro|milímetros)/i);
  if (espMatch) {
    attributes.espessura = parseFloat(espMatch[1].replace(',', '.'));
  }

  // Dimensões (ex: 400 x 500 mm ou 1000 x 2000)
  const dimMatch = clean.match(/\(\s*(\d+\s*x\s*\d+\s*(?:mm|m)?)\s*\)/i) || 
                   clean.match(/(\d{3,4}\s*x\s*\d{3,4}\s*(?:mm|m)?)/i);
  if (dimMatch) {
    attributes.dimensoes = dimMatch[1].trim();
  }

  // Quantidade (ex: 500 metros lineares, 10 peças, 5 chapas)
  const qtdMatch = clean.match(/(\d+[\d.,]*)\s*(?:metros?\s*lineares?|metro\s*linear|m\s*linear|ml|peça|peca|peças|pecas|chapa|chapas|unidades|unidade|m2|metros|m²)/i);
  if (qtdMatch) {
    attributes.quantidade = qtdMatch[0].trim();
  }

  return attributes;
}

/**
 * Consulta o catálogo de variantes v3 com filtragem facetada progressiva (E-commerce Ativo)
 */
export async function getFacetedCatalogOptions(criteria: FacetFilterCriteria): Promise<CatalogFacetResult> {
  // 1. Tentar buscar em catalog_variants_v3 (catálogo oficial completo)
  try {
    let query = supabase.from('catalog_variants_v3').select('*');

    if (criteria.modelo) {
      query = query.or(`product_slug.ilike.%${criteria.modelo}%,f_modelo.ilike.%${criteria.modelo}%`);
    } else if (criteria.familia) {
      query = query.or(`family_slug.ilike.%${criteria.familia}%,category_slug.ilike.%${criteria.familia}%`);
    }

    if (criteria.material) {
      query = query.or(`f_material.ilike.%${criteria.material}%,technical_attributes->>material.ilike.%${criteria.material}%`);
    }

    const { data: v3Data, error } = await query.limit(60);

    if (!error && v3Data && v3Data.length > 0) {
      const modelosSet = new Set<string>();
      const malhaMap = new Map<string, { malha_a?: number; malha_b?: number; label: string }>();
      const alturasSet = new Set<number>();
      const largurasSet = new Set<number>();
      const acabamentosSet = new Set<string>();
      const aramesSet = new Set<number>();
      const matMap = new Map<string, { key: string; label: string }>();
      const espSet = new Set<number>();

      v3Data.forEach((v: any) => {
        const pSlug = v.product_slug || v.f_modelo;
        if (pSlug) modelosSet.add(pSlug);

        const attrs = v.technical_attributes || {};

        // Malha
        const ma = attrs.malha_a_mm || attrs.malha_a;
        const mb = attrs.malha_b_mm || attrs.malha_b;
        if (ma && mb) {
          const key = `${ma}x${mb}`;
          if (!malhaMap.has(key)) {
            malhaMap.set(key, { malha_a: ma, malha_b: mb, label: `${ma} x ${mb} mm` });
          }
        } else if (attrs.malha_original) {
          if (!malhaMap.has(attrs.malha_original)) {
            malhaMap.set(attrs.malha_original, { label: attrs.malha_original });
          }
        }

        // Altura
        const alt = attrs.altura_mm || attrs.altura;
        if (alt && typeof alt === 'number') alturasSet.add(alt);

        // Largura
        const larg = attrs.largura_padrao_mm || attrs.largura_mm || v.f_largura_mm;
        if (larg && typeof larg === 'number') largurasSet.add(larg);

        // Acabamentos
        if (Array.isArray(attrs.acabamentos)) {
          attrs.acabamentos.forEach((ac: string) => acabamentosSet.add(ac));
        } else if (v.f_acabamento) {
          acabamentosSet.add(v.f_acabamento);
        }

        // Arames / Fios
        if (Array.isArray(attrs.diametros_arame_mm)) {
          attrs.diametros_arame_mm.forEach((ar: number) => aramesSet.add(ar));
        } else if (attrs.diametro_arame_mm) {
          aramesSet.add(attrs.diametro_arame_mm);
        }

        // Materiais
        const mat = v.f_material || attrs.material;
        if (mat && !matMap.has(mat)) {
          matMap.set(mat, { key: mat, label: attrs.material_original || mat.replace(/_/g, ' ') });
        }

        // Espessura
        const esp = v.f_espessura_mm || attrs.espessura_mm;
        if (esp) espSet.add(esp);
      });

      return {
        familia: criteria.familia,
        modelo: criteria.modelo,
        modelos_disponiveis: Array.from(modelosSet),
        malhas_disponiveis: Array.from(malhaMap.values()),
        alturas_disponiveis: Array.from(alturasSet).sort((a, b) => a - b),
        larguras_disponiveis: Array.from(largurasSet).sort((a, b) => a - b),
        acabamentos_disponiveis: Array.from(acabamentosSet),
        arames_disponiveis: Array.from(aramesSet).sort((a, b) => a - b),
        materiais_disponiveis: Array.from(matMap.values()),
        espessuras_disponiveis: Array.from(espSet).sort((a, b) => a - b),
        variantes_exatas: v3Data,
        total_encontradas: v3Data.length,
      };
    }
  } catch (err) {
    console.warn('[CatalogFaceted] Erro ao consultar catalog_variants_v3:', err);
  }

  // Fallback: tabela antiga product_variants
  return {
    familia: criteria.familia,
    modelo: criteria.modelo,
    modelos_disponiveis: [],
    malhas_disponiveis: [],
    alturas_disponiveis: [],
    larguras_disponiveis: [],
    acabamentos_disponiveis: [],
    arames_disponiveis: [],
    materiais_disponiveis: [],
    espessuras_disponiveis: [],
    variantes_exatas: [],
    total_encontradas: 0,
  };
}

/**
 * Constrói instruções rigorosas de filtro de e-commerce e múltipla escolha para a IA
 */
export function formatFacetedContextForPrompt(facets: CatalogFacetResult, detected: any): string {
  const familia = facets.familia || detected.familia || 'Geral';
  const modelo = facets.modelo || detected.modelo || null;

  let text = '\n=== CATÁLOGO TÉCNICO OFICIAL & REGRAS DE FILTRO E-COMMERCE ATIVO (MÚLTIPLA ESCOLHA) ===\n';
  text += `Família: ${familia.toUpperCase()}${modelo ? ` | Modelo Selecionado: ${modelo.toUpperCase()}` : ''}\n\n`;

  text += `🚨 REGRA FUNDAMENTAL — O LINO DEVE SER ATIVO COMO UMA PROVA DE MÚLTIPLA ESCOLHA / FILTRO DE E-COMMERCE:
1. NUNCA faça perguntas abertas genéricas como "por favor me informe a altura e largura em milímetros". O cliente não conhece o catálogo da fábrica e não sabe as medidas que existem!
2. O Lino DEVE SE ANTECIPAR e guiar a qualificação apresentando as OPÇÕES REAIS DE FÁBRICA em formato de MENU / MÚLTIPLA ESCOLHA.
3. Siga SEMPRE a hierarquia do maior para o menor:\n`;

  // Se o cliente mencionou Gradil ou Stadium
  if (familia === 'gradil' || modelo === 'stadium' || detected.familia === 'gradil') {
    if (!modelo || modelo === 'gradil') {
      text += `\nETAPA 1 — MODELO DE GRADIL (se ainda não escolheu):
Apresente a lista de modelos de Gradil disponíveis:
1. Stadium (Eletrofundido com dobras de reforço, malha 50x200mm — o mais vendido para cercamentos e obras)
2. Artis (Malha 65x132mm)
3. Sigma (Malha 75x132mm)
4. Omega (Malha 75x66mm)
5. Leone (Malha 65x66mm)
6. Parque (Barras maciças verticais reforçadas)
Pergunta: "Qual desses modelos atende melhor ao seu projeto?"\n`;
    }

    if (modelo === 'stadium' || (!modelo && facets.modelos_disponiveis.includes('stadium'))) {
      text += `\nETAPA 2 — ESPECIFICAÇÃO TÉCNICA GRADIL STADIUM (OPÇÕES REAIS DE FÁBRICA):
- Malha padrão eletrofundida: 50 x 200 mm
- Largura padrão de cada painel: 2.500 mm (2,50 metros)
- Alturas de painel padrão de fábrica:
  1. 1.030 mm (1,03 m)
  2. 1.530 mm (1,53 m)
  3. 2.030 mm (2,03 m)
  4. 2.430 mm (2,43 m)

- Acabamentos disponíveis:
  1. Galvanizado a Fogo (máxima durabilidade contra ferrugem para áreas externas)
  2. Pintura Eletrostática a pó (cores personalizadas sobre galvanização)
  3. Aço Bruto Natural

- Diâmetro dos arames: 4,0 mm ou 4,8 mm reforçado
- Pilares de sustentação: Chumbados em broca de concreto ou com Sapata parafusada

COMO O LINO DEVE PROCEDER AO APRESENTAR O STADIUM:
- Informar que a malha padrão é 50 x 200 mm e cada painel tem 2,5 m de largura.
- Apresentar as 4 alturas padrão (1,03m / 1,53m / 2,03m / 2,43m) como múltipla escolha para o cliente escolher uma.
- Se o cliente pedir uma altura fora do padrão (ex: 4 metros), explicar cordialmente que a altura máxima padrão de um painel de fábrica é 2.430 mm, e sugerir a sobreposição de painéis (ex: 2 painéis de 2,03m) ou confirmar a altura padrão mais próxima.\n`;
    } else if (facets.alturas_disponiveis.length > 0) {
      text += `\nAlturas padrão de fábrica disponíveis no catálogo para este gradil:
${facets.alturas_disponiveis.map((a, i) => `${i + 1}. ${a} mm (${(a / 1000).toFixed(2)} m)`).join('\n')}
Apresente essas opções para o cliente escolher!\n`;
    }
  }

  // Chapas perfuradas ou expandidas
  if (familia === 'chapa_expandida') {
    text += `\nETAPA ESPECÍFICA — CHAPA EXPANDIDA:
Apresente as opções de malha e material:
- Materiais: Aço Carbono, Aço Inox ou Alumínio
- Modelos: Chapa Expandida Fina, Grossa ou Grade de Piso GME
Pergunte o material e aplicação para sugerir a malha correta.\n`;
  } else if (familia === 'chapa_perfurada') {
    text += `\nETAPA ESPECÍFICA — CHAPA PERFURADA:
Apresente as opções técnicas:
- Tipo de furo: Redondo, Quadrado, Oblongo ou Decorativo
- Materiais: Aço Carbono, Aço Galvanizado, Aço Inox ou Alumínio
Pergunte o diâmetro do furo e espessura desejada.\n`;
  }

  text += `\nLEMBRE-SE: Seja direto, consultivo, objetivo e rápido. Apresente os menus numerados para o cliente apenas escolher 1, 2 ou 3!\n`;

  return text;
}
