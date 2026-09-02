-- ==============================================================================
-- MIGRATION v3-002: MODELO DE DOMÍNIO (EXPAND-AND-CONTRACT)
-- Cria tabelas novas sem remover as existentes.
-- Compatibilidade com leads, interactions e admin_users preservada.
-- ==============================================================================

-- ─── 1. CONTATOS (uma pessoa pode ter múltiplas oportunidades) ───────────────
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  whatsapp_number TEXT NOT NULL,
  phone_normalized TEXT NOT NULL,   -- formato canônico: 55DDNNNNNNNNN
  push_name TEXT,
  name TEXT,
  email TEXT,
  company TEXT,
  cnpj TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contacts_tenant_phone
  ON public.contacts(tenant_id, phone_normalized);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone_normalized);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contacts_anon_deny" ON public.contacts FOR ALL TO anon USING (false);
CREATE POLICY "contacts_authenticated" ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 2. CONVERSAS (canal de comunicação de um contato) ───────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  instance_id UUID REFERENCES public.instances(id) ON DELETE SET NULL,
  automation_state TEXT NOT NULL DEFAULT 'BOT_ACTIVE'
    CHECK (automation_state IN ('BOT_ACTIVE', 'HUMAN_REQUESTED', 'HUMAN_ACTIVE', 'BOT_RESUMED')),
  bot_paused_at TIMESTAMPTZ,
  human_took_over_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_contact ON public.conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_state ON public.conversations(tenant_id, automation_state);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conversations_anon_deny" ON public.conversations FOR ALL TO anon USING (false);
CREATE POLICY "conversations_authenticated" ON public.conversations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 3. OPORTUNIDADES (processo comercial de uma conversa) ───────────────────
CREATE TABLE IF NOT EXISTS public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  -- Referência de compatibilidade com leads legado
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,

  status TEXT NOT NULL DEFAULT 'NEW'
    CHECK (status IN (
      'NEW', 'SDR_ACTIVE', 'SDR_ABANDONED',
      'READY_TO_ROUTE', 'ROUTING', 'ROUTING_FAILED',
      'ASSIGNED_WAITING_CONTACT', 'SELLER_ACTIVE',
      'WAITING_QUOTE', 'ORDER_CONFIRMED',
      'POST_SALE', 'CLOSED', 'CANCELLED'
    )),

  -- Dados comerciais
  detected_product TEXT,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  segment TEXT,
  brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  quantity TEXT,
  technical_resolution TEXT
    CHECK (technical_resolution IN ('PROVIDED', 'PARTIAL', 'NEEDS_SPECIALIST', NULL)),
  qualification_schema_version TEXT,
  collected_fields JSONB DEFAULT '{}'::jsonb,
  field_states JSONB DEFAULT '{}'::jsonb,         -- estados por campo: COLLECTED/INVALID/REFUSED/NEEDS_SPECIALIST
  qualification_completed BOOLEAN DEFAULT false,
  qualification_completed_at TIMESTAMPTZ,

  -- Contexto de origem
  context_source TEXT,
  context_interest TEXT,
  tracking_code TEXT,

  -- Controle de versão para concorrência (optimistic lock)
  version INT NOT NULL DEFAULT 1,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunities_contact ON public.opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON public.opportunities(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_opportunities_lead ON public.opportunities(lead_id);

ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "opportunities_anon_deny" ON public.opportunities FOR ALL TO anon USING (false);
CREATE POLICY "opportunities_authenticated" ON public.opportunities FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 4. ATRIBUIÇÕES (vendedor responsável por uma oportunidade) ──────────────
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  assigned_user_id UUID NOT NULL REFERENCES public.admin_users(id) ON DELETE CASCADE,
  routing_rule_id UUID REFERENCES public.routing_rules(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'CONTACTED', 'QUOTE_SENT', 'REJECTED', 'TRANSFERRED')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  first_contact_at TIMESTAMPTZ,
  quote_sent_at TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ,
  sla_breached BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_opportunity ON public.assignments(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user ON public.assignments(assigned_user_id, status);
CREATE INDEX IF NOT EXISTS idx_assignments_sla ON public.assignments(sla_deadline) WHERE sla_breached = false;

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "assignments_anon_deny" ON public.assignments FOR ALL TO anon USING (false);
CREATE POLICY "assignments_authenticated" ON public.assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 5. PEDIDOS VERIFICADOS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.verified_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  order_reference TEXT NOT NULL,   -- número do pedido externo ou NF
  order_source TEXT DEFAULT 'manual'
    CHECK (order_source IN ('manual', 'api', 'erp')),
  verified_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verified_orders_contact ON public.verified_orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_verified_orders_ref ON public.verified_orders(order_reference);

ALTER TABLE public.verified_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "verified_orders_anon_deny" ON public.verified_orders FOR ALL TO anon USING (false);
CREATE POLICY "verified_orders_authenticated" ON public.verified_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 6. TICKETS PÓS-VENDA ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  verified_order_id UUID REFERENCES public.verified_orders(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  intent TEXT,            -- ex: ORDER_STATUS, DAMAGE, MISSING_QUANTITY
  description TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED')),
  priority TEXT DEFAULT 'NORMAL'
    CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  assigned_to UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_contact ON public.tickets(contact_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(tenant_id, status);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets_anon_deny" ON public.tickets FOR ALL TO anon USING (false);
CREATE POLICY "tickets_authenticated" ON public.tickets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 7. EVENTOS DE DOMÍNIO ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.domain_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,     -- 'opportunity', 'assignment', 'ticket', 'conversation'
  aggregate_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  actor_type TEXT DEFAULT 'system',  -- 'system', 'user', 'bot', 'webhook'
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate ON public.domain_events(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_domain_events_type ON public.domain_events(tenant_id, event_type, created_at DESC);

ALTER TABLE public.domain_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domain_events_anon_deny" ON public.domain_events FOR ALL TO anon USING (false);
CREATE POLICY "domain_events_authenticated" ON public.domain_events FOR SELECT TO authenticated USING (true);

-- ─── 8. HISTÓRICO DE TRANSIÇÕES DE OPORTUNIDADES ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.opportunity_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT,
  actor_type TEXT DEFAULT 'system',
  actor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_transitions_opp ON public.opportunity_transitions(opportunity_id, created_at DESC);
