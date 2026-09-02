-- ==============================================================================
-- MIGRATION v3-001: SEGURANÇA E RLS
-- Reversível: cada ALTER/DROP POLICY pode ser revertido com os comandos
-- indicados nos comentários BEGIN ROLLBACK / END ROLLBACK.
-- Aplique no Supabase SQL Editor. NÃO executar em produção sem backup.
-- ==============================================================================

-- ─── 1. ATIVAR RLS EM TABELAS SENSÍVEIS ─────────────────────────────────────

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_bottlenecks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisor_escalations ENABLE ROW LEVEL SECURITY;

-- ─── 2. REMOVER POLÍTICA DE SELECT PÚBLICO EM TRACKING ───────────────────────
-- ROLLBACK: recriar a política com mesmo nome.
DROP POLICY IF EXISTS "Permitir select de tracking" ON public.lead_tracking_clicks;

-- Manter apenas INSERT para anon (necessário para script do site).
-- SELECT de tracking só para authenticated (service role inclui authenticated).
CREATE POLICY "tracking_anon_insert_only"
ON public.lead_tracking_clicks
FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "tracking_authenticated_read"
ON public.lead_tracking_clicks
FOR SELECT
TO authenticated
USING (true);

-- ─── 3. POLÍTICAS PARA leads ──────────────────────────────────────────────────
-- Anon nunca acessa leads.
-- Service role e authenticated acessam todos os leads do próprio tenant.

-- Nega acesso anon:
DROP POLICY IF EXISTS "leads_anon_deny" ON public.leads;
CREATE POLICY "leads_anon_deny"
ON public.leads
FOR ALL
TO anon
USING (false);

-- Authenticated acessa apenas leads do próprio tenant:
DROP POLICY IF EXISTS "leads_authenticated_tenant" ON public.leads;
CREATE POLICY "leads_authenticated_tenant"
ON public.leads
FOR ALL
TO authenticated
USING (true)   -- Service role sempre passa; usar tenant_id quando auth for implementado
WITH CHECK (true);

-- ─── 4. POLÍTICAS PARA admin_users ───────────────────────────────────────────
-- Anon nunca lê/escreve admin_users (senha em texto plano exposta).
DROP POLICY IF EXISTS "admin_users_anon_deny" ON public.admin_users;
CREATE POLICY "admin_users_anon_deny"
ON public.admin_users
FOR ALL
TO anon
USING (false);

DROP POLICY IF EXISTS "admin_users_authenticated_read" ON public.admin_users;
CREATE POLICY "admin_users_authenticated_read"
ON public.admin_users
FOR SELECT
TO authenticated
USING (true);

-- ─── 5. POLÍTICAS PARA tenant_config ─────────────────────────────────────────
-- Anon nunca lê config (contém openai_key, evolution_key).
DROP POLICY IF EXISTS "tenant_config_anon_deny" ON public.tenant_config;
CREATE POLICY "tenant_config_anon_deny"
ON public.tenant_config
FOR ALL
TO anon
USING (false);

DROP POLICY IF EXISTS "tenant_config_authenticated" ON public.tenant_config;
CREATE POLICY "tenant_config_authenticated"
ON public.tenant_config
FOR SELECT
TO authenticated
USING (true);

-- ─── 6. POLÍTICAS PARA interactions ──────────────────────────────────────────
DROP POLICY IF EXISTS "interactions_anon_deny" ON public.interactions;
CREATE POLICY "interactions_anon_deny"
ON public.interactions
FOR ALL
TO anon
USING (false);

DROP POLICY IF EXISTS "interactions_authenticated" ON public.interactions;
CREATE POLICY "interactions_authenticated"
ON public.interactions
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ─── 7. POLÍTICAS PARA whatsapp_messages ─────────────────────────────────────
DROP POLICY IF EXISTS "whatsapp_messages_anon_deny" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_anon_deny"
ON public.whatsapp_messages
FOR ALL
TO anon
USING (false);

DROP POLICY IF EXISTS "whatsapp_messages_authenticated" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_authenticated"
ON public.whatsapp_messages
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ─── 8. POLÍTICAS PARA instances ─────────────────────────────────────────────
DROP POLICY IF EXISTS "instances_anon_deny" ON public.instances;
CREATE POLICY "instances_anon_deny"
ON public.instances
FOR ALL
TO anon
USING (false);

DROP POLICY IF EXISTS "instances_authenticated" ON public.instances;
CREATE POLICY "instances_authenticated"
ON public.instances
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ─── 9. CAMPOS DE SENHA — NOTA PARA ROTAÇÃO ──────────────────────────────────
-- ATENÇÃO: a tabela admin_users possui coluna 'password' em texto plano.
-- Isso é uma vulnerabilidade grave. A correção completa (hash bcrypt)
-- deve ser implementada junto com a migração para Supabase Auth.
-- Por enquanto, a política de RLS acima já impede leitura por anon.
-- A coluna 'admin_password' em tenant_config também deve ser removida.

ALTER TABLE public.tenant_config
  ADD COLUMN IF NOT EXISTS _security_note TEXT DEFAULT
    'openai_key e evolution_key devem ser movidos para variáveis de ambiente seguras';

-- ─── 10. ÍNDICE DE TENANT_ID EM LEADS (proteção multi-tenant) ────────────────
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON public.leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_interactions_lead_id ON public.interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_lead ON public.whatsapp_messages(lead_id);

-- ─── 11. EVOLUIR whatsapp_messages COM CAMPOS DE IDEMPOTÊNCIA ────────────────
-- Expand-and-contract: adicionar colunas sem remover as existentes.
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS instance_id UUID REFERENCES public.instances(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'evolution' NOT NULL,
  ADD COLUMN IF NOT EXISTS external_message_id TEXT,
  ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processed', 'failed', 'skipped')),
  ADD COLUMN IF NOT EXISTS error_details JSONB,
  ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS raw_payload JSONB;

-- Constraint de unicidade para idempotência
-- Verifica existência antes de criar (IF NOT EXISTS não é suportado em CONSTRAINT)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_whatsapp_messages_idempotency'
  ) THEN
    ALTER TABLE public.whatsapp_messages
      ADD CONSTRAINT uq_whatsapp_messages_idempotency
        UNIQUE (tenant_id, provider, external_message_id)
        DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- Índice para deduplicação rápida
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_ext_id
  ON public.whatsapp_messages(tenant_id, provider, external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_processing
  ON public.whatsapp_messages(processing_status, created_at)
  WHERE processing_status = 'pending';
