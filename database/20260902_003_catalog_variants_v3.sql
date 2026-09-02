-- ==============================================================================
-- MIGRATION v3-003: CATÁLOGO DE VARIANTES V3
-- Cria a tabela catalog_variants_v3 de forma totalmente aditiva.
-- Schema v3.0.0 conforme canonical_variant.schema.json do pacote.
-- ==============================================================================

-- ─── 1. TABELA PRINCIPAL DO CATÁLOGO ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.catalog_variants_v3 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Identidade da variante
  schema_version TEXT NOT NULL DEFAULT '3.0.0',
  record_kind TEXT NOT NULL DEFAULT 'technical_variant',
  variant_id TEXT NOT NULL,            -- ID único do pacote v3 (ex: "3147416694db")

  -- Hierarquia de produto
  tenant_slug TEXT NOT NULL,
  brand_slug TEXT NOT NULL,
  family_slug TEXT NOT NULL,
  product_slug TEXT NOT NULL,
  category_slug TEXT NOT NULL,

  -- Status editorial
  approval_status TEXT NOT NULL DEFAULT 'APPROVED'
    CHECK (approval_status IN ('APPROVED', 'PENDING', 'REJECTED', 'ARCHIVED')),
  active_for_lino BOOLEAN NOT NULL DEFAULT TRUE,

  -- Atributos técnicos (JSONB flexível)
  technical_attributes JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Campos de busca facetada (extraídos de technical_attributes)
  -- Preenchidos por GENERATED ALWAYS (Postgres 15+) ou via trigger
  f_material TEXT,
  f_acabamento TEXT,
  f_modelo TEXT,
  f_formato_chapa TEXT,
  f_largura_mm NUMERIC,
  f_comprimento_mm NUMERIC,
  f_espessura_mm NUMERIC,

  -- Dados de origem/auditoria
  source_file TEXT,
  source_line INT,
  commercial_data_excluded BOOLEAN DEFAULT TRUE,

  -- Embedding para busca semântica (a popular futuramente)
  embedding VECTOR(1536),

  -- Timestamps
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── 2. UNICIDADE TENANT + VARIANT_ID ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_catalog_variants_v3_tenant_variant'
  ) THEN
    ALTER TABLE public.catalog_variants_v3
      ADD CONSTRAINT uq_catalog_variants_v3_tenant_variant
        UNIQUE (tenant_id, variant_id);
  END IF;
END $$;

-- ─── 3. ÍNDICES PARA BUSCA FACETADA ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cv3_tenant_active
  ON public.catalog_variants_v3(tenant_id, active_for_lino)
  WHERE active_for_lino = TRUE;

CREATE INDEX IF NOT EXISTS idx_cv3_brand_product
  ON public.catalog_variants_v3(tenant_id, brand_slug, product_slug);

CREATE INDEX IF NOT EXISTS idx_cv3_family_category
  ON public.catalog_variants_v3(family_slug, category_slug);

CREATE INDEX IF NOT EXISTS idx_cv3_attrs_gin
  ON public.catalog_variants_v3 USING GIN(technical_attributes);

CREATE INDEX IF NOT EXISTS idx_cv3_material
  ON public.catalog_variants_v3(tenant_id, f_material)
  WHERE f_material IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cv3_format
  ON public.catalog_variants_v3(tenant_id, f_formato_chapa)
  WHERE f_formato_chapa IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cv3_largura
  ON public.catalog_variants_v3(tenant_id, f_largura_mm)
  WHERE f_largura_mm IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cv3_espessura
  ON public.catalog_variants_v3(tenant_id, f_espessura_mm)
  WHERE f_espessura_mm IS NOT NULL;

-- ─── 4. TRIGGER PARA POPULAR CAMPOS FACETADOS ────────────────────────────────
CREATE OR REPLACE FUNCTION public.populate_catalog_v3_facets()
RETURNS TRIGGER AS $$
BEGIN
  NEW.f_material    := NEW.technical_attributes->>'material';
  NEW.f_acabamento  := NEW.technical_attributes->>'acabamento';
  NEW.f_modelo      := NEW.technical_attributes->>'modelo';
  NEW.f_formato_chapa := NEW.technical_attributes->>'formato_chapa_original';
  NEW.f_largura_mm  := (NEW.technical_attributes->>'largura_chapa_mm')::NUMERIC;
  NEW.f_comprimento_mm := (NEW.technical_attributes->>'comprimento_chapa_mm')::NUMERIC;
  NEW.f_espessura_mm := (NEW.technical_attributes->>'espessura_mm')::NUMERIC;
  NEW.updated_at    := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_catalog_v3_facets ON public.catalog_variants_v3;
CREATE TRIGGER trg_catalog_v3_facets
  BEFORE INSERT OR UPDATE ON public.catalog_variants_v3
  FOR EACH ROW EXECUTE FUNCTION public.populate_catalog_v3_facets();

-- ─── 5. RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.catalog_variants_v3 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "catalog_v3_anon_deny" ON public.catalog_variants_v3
  FOR ALL TO anon USING (false);

CREATE POLICY "catalog_v3_authenticated" ON public.catalog_variants_v3
  FOR SELECT TO authenticated USING (active_for_lino = TRUE);

-- Service role bypassa RLS automaticamente.

-- ─── 6. FUNÇÃO RPC DE BUSCA FACETADA ─────────────────────────────────────────
-- Retorna variantes por atributos com suporte a busca parcial.
-- Parâmetros opcionais — nulls ignorados no filtro.
CREATE OR REPLACE FUNCTION public.search_catalog_v3(
  p_tenant_id UUID,
  p_brand_slug TEXT DEFAULT NULL,
  p_family_slug TEXT DEFAULT NULL,
  p_product_slug TEXT DEFAULT NULL,
  p_category_slug TEXT DEFAULT NULL,
  p_material TEXT DEFAULT NULL,
  p_acabamento TEXT DEFAULT NULL,
  p_modelo TEXT DEFAULT NULL,
  p_formato_chapa TEXT DEFAULT NULL,
  p_largura_min NUMERIC DEFAULT NULL,
  p_largura_max NUMERIC DEFAULT NULL,
  p_espessura_min NUMERIC DEFAULT NULL,
  p_espessura_max NUMERIC DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  variant_id TEXT,
  brand_slug TEXT,
  family_slug TEXT,
  product_slug TEXT,
  category_slug TEXT,
  technical_attributes JSONB,
  f_material TEXT,
  f_acabamento TEXT,
  f_modelo TEXT,
  f_formato_chapa TEXT,
  f_largura_mm NUMERIC,
  f_comprimento_mm NUMERIC,
  f_espessura_mm NUMERIC,
  total_count BIGINT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    cv.id,
    cv.variant_id,
    cv.brand_slug,
    cv.family_slug,
    cv.product_slug,
    cv.category_slug,
    cv.technical_attributes,
    cv.f_material,
    cv.f_acabamento,
    cv.f_modelo,
    cv.f_formato_chapa,
    cv.f_largura_mm,
    cv.f_comprimento_mm,
    cv.f_espessura_mm,
    COUNT(*) OVER() AS total_count
  FROM public.catalog_variants_v3 cv
  WHERE cv.tenant_id = p_tenant_id
    AND cv.active_for_lino = TRUE
    AND cv.approval_status = 'APPROVED'
    AND (p_brand_slug IS NULL OR cv.brand_slug = p_brand_slug)
    AND (p_family_slug IS NULL OR cv.family_slug = p_family_slug)
    AND (p_product_slug IS NULL OR cv.product_slug = p_product_slug)
    AND (p_category_slug IS NULL OR cv.category_slug ILIKE '%' || p_category_slug || '%')
    AND (p_material IS NULL OR cv.f_material ILIKE '%' || p_material || '%')
    AND (p_acabamento IS NULL OR cv.f_acabamento ILIKE '%' || p_acabamento || '%')
    AND (p_modelo IS NULL OR cv.f_modelo ILIKE '%' || p_modelo || '%')
    AND (p_formato_chapa IS NULL OR cv.f_formato_chapa ILIKE '%' || p_formato_chapa || '%')
    AND (p_largura_min IS NULL OR cv.f_largura_mm >= p_largura_min)
    AND (p_largura_max IS NULL OR cv.f_largura_mm <= p_largura_max)
    AND (p_espessura_min IS NULL OR cv.f_espessura_mm >= p_espessura_min)
    AND (p_espessura_max IS NULL OR cv.f_espessura_mm <= p_espessura_max)
  ORDER BY cv.brand_slug, cv.product_slug, cv.f_modelo
  LIMIT LEAST(p_limit, 100)    -- cap máximo de 100 por chamada
  OFFSET p_offset;
END;
$$;

-- ─── 7. FUNÇÃO RPC: LISTAR CATEGORIAS DISPONÍVEIS ───────────────────────────
CREATE OR REPLACE FUNCTION public.get_catalog_v3_categories(p_tenant_id UUID)
RETURNS TABLE (
  brand_slug TEXT,
  family_slug TEXT,
  product_slug TEXT,
  category_slug TEXT,
  variant_count BIGINT
)
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT
    brand_slug,
    family_slug,
    product_slug,
    category_slug,
    COUNT(*) AS variant_count
  FROM public.catalog_variants_v3
  WHERE tenant_id = p_tenant_id
    AND active_for_lino = TRUE
    AND approval_status = 'APPROVED'
  GROUP BY brand_slug, family_slug, product_slug, category_slug
  ORDER BY brand_slug, family_slug, product_slug, category_slug;
$$;

-- ─── 8. FUNÇÃO RPC: FACETAS DISPONÍVEIS POR PRODUTO ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_catalog_v3_facets(
  p_tenant_id UUID,
  p_product_slug TEXT
)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'materiais', (
      SELECT jsonb_agg(DISTINCT f_material ORDER BY f_material)
      FROM public.catalog_variants_v3
      WHERE tenant_id = p_tenant_id AND product_slug = p_product_slug
        AND active_for_lino = TRUE AND f_material IS NOT NULL
    ),
    'acabamentos', (
      SELECT jsonb_agg(DISTINCT f_acabamento ORDER BY f_acabamento)
      FROM public.catalog_variants_v3
      WHERE tenant_id = p_tenant_id AND product_slug = p_product_slug
        AND active_for_lino = TRUE AND f_acabamento IS NOT NULL
    ),
    'formatos_chapa', (
      SELECT jsonb_agg(DISTINCT f_formato_chapa ORDER BY f_formato_chapa)
      FROM public.catalog_variants_v3
      WHERE tenant_id = p_tenant_id AND product_slug = p_product_slug
        AND active_for_lino = TRUE AND f_formato_chapa IS NOT NULL
    ),
    'modelos', (
      SELECT jsonb_agg(DISTINCT f_modelo ORDER BY f_modelo)
      FROM public.catalog_variants_v3
      WHERE tenant_id = p_tenant_id AND product_slug = p_product_slug
        AND active_for_lino = TRUE AND f_modelo IS NOT NULL
    )
  );
$$;
