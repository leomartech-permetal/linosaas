-- ============================================================
-- MIGRATION: routing_rules — Multi-select + Roleta de Vendedores
-- Skill: lino-database-backend | Aprovado por: lino-supervisor
-- Data: 2026-05-08
-- Reversível: SIM (colunas antigas mantidas)
-- ============================================================

-- 1. Adicionar colunas para arrays (novas)
ALTER TABLE routing_rules
  ADD COLUMN IF NOT EXISTS region_ids  text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS product_ids uuid[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS seller_ids  uuid[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_seller_index int DEFAULT 0;

-- 2. Índices para performance (filtros por array)
CREATE INDEX IF NOT EXISTS idx_routing_rules_region_ids  ON routing_rules USING GIN (region_ids);
CREATE INDEX IF NOT EXISTS idx_routing_rules_product_ids ON routing_rules USING GIN (product_ids);
CREATE INDEX IF NOT EXISTS idx_routing_rules_seller_ids  ON routing_rules USING GIN (seller_ids);

-- 3. NOTA: colunas antigas (region text, product_id uuid, assigned_user_id uuid)
--    são mantidas por compatibilidade retroativa.
--    O router.ts prioriza as novas colunas array quando preenchidas.

-- ============================================================
-- ROLLBACK (executar se necessário reverter):
-- ALTER TABLE routing_rules DROP COLUMN IF EXISTS region_ids;
-- ALTER TABLE routing_rules DROP COLUMN IF EXISTS product_ids;
-- ALTER TABLE routing_rules DROP COLUMN IF EXISTS seller_ids;
-- ALTER TABLE routing_rules DROP COLUMN IF EXISTS last_seller_index;
-- ============================================================
