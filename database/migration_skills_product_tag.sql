-- Migration: adicionar coluna product_tag na tabela skills
-- Esta coluna permite filtrar skills por produto, tornando buildContext() seletivo
-- Skills sem product_tag = genéricas (carregadas em qualquer fase)
-- Skills com product_tag = especializadas (carregadas só quando produto for detectado)

ALTER TABLE public.skills ADD COLUMN IF NOT EXISTS product_tag TEXT DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.skills.product_tag IS 
  'Tag do produto que esta skill atende. Ex: "chapa perfurada", "gradil", "grade de piso". 
   NULL = skill genérica (carregada sempre). 
   Preenchido = skill carregada apenas quando o produto for detectado na conversa.';

-- Índice para performance no filtro por produto
CREATE INDEX IF NOT EXISTS idx_skills_product_tag ON public.skills(product_tag);
CREATE INDEX IF NOT EXISTS idx_skills_active_product ON public.skills(active, product_tag);
