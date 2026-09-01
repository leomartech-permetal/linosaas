import { supabase } from './supabase';

export interface FacetFilterCriteria {
  familia?: string;
  categoria?: string;
  malha_a?: number;
  malha_b?: number;
  material?: string;
  espessura?: number;
}

export interface CatalogFacetResult {
  familia?: string;
  malhas_disponiveis: { malha_a: number; malha_b: number; label: string }[];
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
  }

  // Malha / AxB (ex: 20x50, 20 x 50, AxB 20x50)
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

  // Dimensões de chapa (ex: 400 x 500 mm ou 1000 x 2000)
  const dimMatch = clean.match(/\(\s*(\d+\s*x\s*\d+\s*(?:mm|m)?)\s*\)/i) || 
                   clean.match(/(\d{3,4}\s*x\s*\d{3,4}\s*(?:mm|m)?)/i);
  if (dimMatch) {
    attributes.dimensoes = dimMatch[1].trim();
  }

  // Quantidade (ex: 1 peça, 10 peças, 5 chapas)
  const qtdMatch = clean.match(/(\d+)\s*(?:peça|peca|peças|pecas|chapa|chapas|unidades|unidade|m2|metros)/i);
  if (qtdMatch) {
    attributes.quantidade = qtdMatch[0].trim();
  }

  return attributes;
}

/**
 * Consulta o catálogo de variantes com filtragem facetada progressiva (E-commerce)
 */
export async function getFacetedCatalogOptions(criteria: FacetFilterCriteria): Promise<CatalogFacetResult> {
  let query = supabase.from('product_variants').select('*').eq('ativo_para_filtro', true);

  if (criteria.familia) {
    query = query.ilike('familia', `%${criteria.familia}%`);
  }
  if (criteria.categoria) {
    query = query.ilike('categoria', `%${criteria.categoria}%`);
  }
  if (criteria.malha_a !== undefined && criteria.malha_b !== undefined) {
    query = query.eq('malha_a_mm', criteria.malha_a).eq('malha_b_mm', criteria.malha_b);
  }
  if (criteria.material) {
    query = query.ilike('material', `%${criteria.material}%`);
  }
  if (criteria.espessura !== undefined) {
    query = query.eq('espessura_mm', criteria.espessura);
  }

  const { data: variants, error } = await query.limit(50);

  if (error || !variants) {
    return {
      malhas_disponiveis: [],
      materiais_disponiveis: [],
      espessuras_disponiveis: [],
      variantes_exatas: [],
      total_encontradas: 0
    };
  }

  // Extrair facetas únicas
  const malhaMap = new Map<string, { malha_a: number; malha_b: number; label: string }>();
  const matMap = new Map<string, { key: string; label: string }>();
  const espSet = new Set<number>();

  variants.forEach((v) => {
    if (v.malha_a_mm && v.malha_b_mm) {
      const key = `${v.malha_a_mm}x${v.malha_b_mm}`;
      if (!malhaMap.has(key)) {
        malhaMap.set(key, {
          malha_a: v.malha_a_mm,
          malha_b: v.malha_b_mm,
          label: v.malha_original || `${v.malha_a_mm} x ${v.malha_b_mm} mm`
        });
      }
    }
    if (v.material) {
      if (!matMap.has(v.material)) {
        matMap.set(v.material, {
          key: v.material,
          label: v.material_original || v.material
        });
      }
    }
    if (v.espessura_mm) {
      espSet.add(v.espessura_mm);
    }
  });

  return {
    familia: criteria.familia,
    malhas_disponiveis: Array.from(malhaMap.values()),
    materiais_disponiveis: Array.from(matMap.values()),
    espessuras_disponiveis: Array.from(espSet).sort((a, b) => a - b),
    variantes_exatas: variants,
    total_encontradas: variants.length
  };
}

/**
 * Constrói texto descritivo estilo catálogo de e-commerce para orientar a IA
 */
export function formatFacetedContextForPrompt(facets: CatalogFacetResult, detected: any): string {
  if (facets.total_encontradas === 0 && !detected.familia) {
    return '';
  }

  let text = '\n=== CATÁLOGO E-COMMERCE TÉCNICO (OPÇÕES REAIS) ===\n';
  text += `Família identificada: ${facets.familia || detected.familia || 'Geral'}\n`;

  if (detected.malha_a && detected.malha_b) {
    text += `Malha selecionada: ${detected.malha_a}x${detected.malha_b} mm\n`;
  }

  if (facets.materiais_disponiveis.length > 0) {
    const mats = facets.materiais_disponiveis.map(m => m.label).join(', ');
    text += `Materiais fabricados para esta configuração: [${mats}]\n`;
  }

  if (facets.espessuras_disponiveis.length > 0) {
    const esps = facets.espessuras_disponiveis.map(e => `${e} mm`).join(', ');
    text += `Espessuras disponíveis: [${esps}]\n`;
  }

  if (facets.variantes_exatas.length > 0 && facets.variantes_exatas.length <= 5) {
    text += `Correspondências diretas no catálogo:\n`;
    facets.variantes_exatas.forEach(v => {
      text += `- ${v.categoria} | Malha: ${v.malha_original || (v.malha_a_mm + 'x' + v.malha_b_mm)} | Material: ${v.material_original || v.material} | Espessura: ${v.espessura_mm}mm\n`;
    });
  }

  text += `\nREGRA E-COMMERCE: Apresente as opções reais acima ao cliente passo a passo, eliminando as opções não escolhidas até chegar no produto exato. NUNCA invente medidas ou materiais fora dessa lista.\n`;

  return text;
}
