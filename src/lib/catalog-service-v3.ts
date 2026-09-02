/**
 * CATALOG SERVICE v3
 *
 * Camada de acesso ao catálogo de variantes técnicas v3.
 * Usa a RPC search_catalog_v3 (criada na migration 003).
 *
 * DIFERENÇAS vs versão anterior:
 * - Sem limite hardcoded de 50 variantes
 * - Busca facetada por atributos técnicos
 * - Suporte a paginação explícita
 * - Fallback para busca em JSONB quando campos facetados ainda não existem
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization — evita erro em testes sem SUPABASE_URL configurada
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabase;
}

export interface CatalogSearchParams {
  tenantId: string;
  brandSlug?: string;
  familySlug?: string;
  productSlug?: string;
  categorySlug?: string;
  // Atributos técnicos
  material?: string;
  acabamento?: string;
  modelo?: string;
  formatoChapa?: string;
  larguraMin?: number;
  larguraMax?: number;
  espessuraMin?: number;
  espessuraMax?: number;
  // Paginação
  limit?: number;     // padrão: 50, máximo permitido pelo RPC: 100
  offset?: number;
}

export interface CatalogVariant {
  id: string;
  variant_id: string;
  brand_slug: string;
  family_slug: string;
  product_slug: string;
  category_slug: string;
  technical_attributes: Record<string, any>;
  f_material: string | null;
  f_acabamento: string | null;
  f_modelo: string | null;
  f_formato_chapa: string | null;
  f_largura_mm: number | null;
  f_comprimento_mm: number | null;
  f_espessura_mm: number | null;
  total_count?: number;
}

export interface CatalogSearchResult {
  variants: CatalogVariant[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Busca variantes técnicas no catálogo v3 usando RPC.
 * Suporta todos os atributos facetados com filtros parciais (ILIKE).
 */
export async function searchCatalogV3(params: CatalogSearchParams): Promise<CatalogSearchResult> {
  const {
    tenantId,
    brandSlug,
    familySlug,
    productSlug,
    categorySlug,
    material,
    acabamento,
    modelo,
    formatoChapa,
    larguraMin,
    larguraMax,
    espessuraMin,
    espessuraMax,
    limit = 50,
    offset = 0,
  } = params;

  // Chamar a RPC search_catalog_v3
  const { data, error } = await getSupabase().rpc('search_catalog_v3', {
    p_tenant_id: tenantId,
    p_brand_slug: brandSlug || null,
    p_family_slug: familySlug || null,
    p_product_slug: productSlug || null,
    p_category_slug: categorySlug || null,
    p_material: material || null,
    p_acabamento: acabamento || null,
    p_modelo: modelo || null,
    p_formato_chapa: formatoChapa || null,
    p_largura_min: larguraMin ?? null,
    p_largura_max: larguraMax ?? null,
    p_espessura_min: espessuraMin ?? null,
    p_espessura_max: espessuraMax ?? null,
    p_limit: Math.min(limit, 100),
    p_offset: offset,
  });

  if (error) {
    // Fallback: busca direto na tabela sem RPC (ex: RPC ainda não criada)
    console.warn('[CatalogServiceV3] RPC não disponível, usando fallback:', error.message);
    return searchCatalogV3Fallback(params);
  }

  const variants = (data || []) as CatalogVariant[];
  const totalCount = variants.length > 0 ? Number(variants[0].total_count) : 0;

  return {
    variants,
    totalCount,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    hasMore: offset + variants.length < totalCount,
  };
}

/**
 * Fallback direto na tabela (para uso enquanto a migration 003 não foi aplicada).
 */
async function searchCatalogV3Fallback(params: CatalogSearchParams): Promise<CatalogSearchResult> {
  const {
    tenantId,
    brandSlug,
    productSlug,
    material,
    limit = 50,
    offset = 0,
  } = params;

  let query = getSupabase()
    .from('catalog_variants_v3')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .eq('active_for_lino', true)
    .eq('approval_status', 'APPROVED');

  if (brandSlug) query = query.eq('brand_slug', brandSlug);
  if (productSlug) query = query.eq('product_slug', productSlug);
  if (material) query = query.ilike('f_material', `%${material}%`);

  query = query
    .order('brand_slug')
    .order('product_slug')
    .range(offset, offset + Math.min(limit, 100) - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('[CatalogServiceV3] Fallback também falhou:', error.message);
    return { variants: [], totalCount: 0, page: 1, pageSize: limit, hasMore: false };
  }

  const variants = (data || []) as CatalogVariant[];
  const totalCount = count || 0;

  return {
    variants,
    totalCount,
    page: Math.floor(offset / limit) + 1,
    pageSize: limit,
    hasMore: offset + variants.length < totalCount,
  };
}

/**
 * Retorna as categorias disponíveis no catálogo para um tenant.
 */
export async function getCatalogCategories(tenantId: string) {
  const { data, error } = await getSupabase().rpc('get_catalog_v3_categories', {
    p_tenant_id: tenantId,
  });

  if (error) {
    console.error('[CatalogServiceV3] Erro ao buscar categorias:', error.message);
    return [];
  }

  return data || [];
}

/**
 * Retorna as facetas disponíveis para um produto específico.
 * Útil para construir filtros dinâmicos na UI.
 */
export async function getCatalogFacets(tenantId: string, productSlug: string) {
  const { data, error } = await getSupabase().rpc('get_catalog_v3_facets', {
    p_tenant_id: tenantId,
    p_product_slug: productSlug,
  });

  if (error) {
    console.error('[CatalogServiceV3] Erro ao buscar facetas:', error.message);
    return null;
  }

  return data;
}

/**
 * Busca uma variante específica pelo variant_id.
 */
export async function getVariantById(tenantId: string, variantId: string): Promise<CatalogVariant | null> {
  const { data, error } = await getSupabase()
    .from('catalog_variants_v3')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('variant_id', variantId)
    .maybeSingle();

  if (error) {
    console.error('[CatalogServiceV3] Erro ao buscar variante:', error.message);
    return null;
  }

  return data;
}

/**
 * Busca variantes por texto livre nos atributos técnicos (JSONB).
 * Complementa a busca facetada quando o usuário descreve um produto
 * de forma não estruturada.
 */
export async function searchCatalogByText(
  tenantId: string,
  searchText: string,
  limit = 20
): Promise<CatalogVariant[]> {
  const { data, error } = await getSupabase()
    .from('catalog_variants_v3')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active_for_lino', true)
    .or(
      `f_modelo.ilike.%${searchText}%,` +
      `f_material.ilike.%${searchText}%,` +
      `product_slug.ilike.%${searchText}%,` +
      `category_slug.ilike.%${searchText}%`
    )
    .limit(Math.min(limit, 100));

  if (error) {
    console.error('[CatalogServiceV3] Erro na busca por texto:', error.message);
    return [];
  }

  return (data || []) as CatalogVariant[];
}

/**
 * Gera um resumo legível de uma variante para uso em prompts do Lino.
 * Remove campos irrelevantes e formata atributos técnicos.
 */
export function formatVariantForPrompt(variant: CatalogVariant): string {
  const attrs = variant.technical_attributes;
  const parts: string[] = [
    `Produto: ${variant.product_slug.replace(/_/g, ' ')} (${variant.brand_slug.toUpperCase()})`,
    `Modelo: ${attrs.modelo || 'N/D'}`,
  ];

  if (attrs.malha_a_mm && attrs.malha_b_mm) {
    parts.push(`Malha: ${attrs.malha_a_mm}×${attrs.malha_b_mm}mm`);
  }
  if (attrs.espessura_mm) parts.push(`Espessura: ${attrs.espessura_mm}mm`);
  if (attrs.cordao_mm) parts.push(`Cordão: ${attrs.cordao_mm}mm`);
  if (attrs.material) parts.push(`Material: ${attrs.material.replace(/_/g, ' ')}`);
  if (attrs.acabamento) parts.push(`Acabamento: ${attrs.acabamento.replace(/_/g, ' ')}`);
  if (attrs.formato_chapa_original) parts.push(`Formato: ${attrs.formato_chapa_original}mm`);
  if (attrs.diametro_arame_mm) parts.push(`Diâmetro arame: ${attrs.diametro_arame_mm}mm`);
  if (attrs.abertura_malha_mm) parts.push(`Abertura de malha: ${attrs.abertura_malha_mm}mm`);

  return parts.join(' | ');
}
