-- ============================================================
-- MIGRATION 010 — Idempotência durável e Outbox persistente
-- Lino v4 — aditivo, sem destruição de dados
-- ============================================================

-- ── inbound_messages ─────────────────────────────────────────────────────
-- Idempotência por webhook: evita duplicar processamento de retransmissões
CREATE TABLE IF NOT EXISTS public.inbound_messages (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID         REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider             TEXT         NOT NULL DEFAULT 'evolution',
  instance_id          TEXT         NOT NULL,
  external_message_id  TEXT         NOT NULL,
  from_number          TEXT         NOT NULL,
  body                 TEXT,
  message_type         TEXT,
  raw_payload          JSONB,
  received_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  processed_at         TIMESTAMPTZ,
  status               TEXT         NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'processed', 'blocked', 'error')),
  error                TEXT,
  correlation_lead_id  UUID,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Índice único para deduplicação durável (substitui Set em memória)
CREATE UNIQUE INDEX IF NOT EXISTS inbound_messages_dedup_idx
  ON public.inbound_messages (tenant_id, provider, instance_id, external_message_id)
  WHERE tenant_id IS NOT NULL;

-- Índice para busca por from_number
CREATE INDEX IF NOT EXISTS inbound_messages_from_number_idx
  ON public.inbound_messages (from_number, received_at DESC);

-- ── outbound_messages ─────────────────────────────────────────────────────
-- Outbox auditável: toda saída WhatsApp registrada antes do envio
CREATE TABLE IF NOT EXISTS public.outbound_messages (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID         REFERENCES public.tenants(id) ON DELETE CASCADE,
  idempotency_key      TEXT         UNIQUE,
  logical_recipient    TEXT,
  logical_role         TEXT         CHECK (logical_role IN ('CUSTOMER','SELLER','SUPERVISOR','SYSTEM', NULL)),
  physical_number      TEXT,
  test_sink_number     TEXT,        -- preenchido apenas em modo de teste
  body                 TEXT         NOT NULL,
  event_type           TEXT,
  correlation_lead_id  UUID,
  status               TEXT         NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  attempts             INT          NOT NULL DEFAULT 0,
  next_attempt_at      TIMESTAMPTZ,
  sent_at              TIMESTAMPTZ,
  external_message_id  TEXT,
  error                TEXT,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Índice para processar outbox pendente
CREATE INDEX IF NOT EXISTS outbound_messages_pending_idx
  ON public.outbound_messages (status, next_attempt_at)
  WHERE status IN ('pending', 'failed');

-- Índice para correlação com lead
CREATE INDEX IF NOT EXISTS outbound_messages_lead_idx
  ON public.outbound_messages (correlation_lead_id, created_at DESC)
  WHERE correlation_lead_id IS NOT NULL;

-- ── service_tickets ───────────────────────────────────────────────────────
-- Tickets de suporte e pós-venda
CREATE TABLE IF NOT EXISTS public.service_tickets (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID         REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id         UUID         REFERENCES public.leads(id) ON DELETE CASCADE,
  flow            TEXT         NOT NULL CHECK (flow IN ('ATTENDANCE_SUPPORT', 'POST_SALE')),
  category        TEXT,
  status          TEXT         NOT NULL DEFAULT 'OPEN'
                    CHECK (status IN ('OPEN','PENDING_INTERNAL','PENDING_CUSTOMER','ESCALATED','RESOLVED','CLOSED')),
  priority        TEXT         NOT NULL DEFAULT 'NORMAL'
                    CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
  assigned_to     UUID         REFERENCES public.admin_users(id),
  order_reference TEXT,
  sla_due_at      TIMESTAMPTZ,
  sla_breached    BOOLEAN      NOT NULL DEFAULT false,
  opened_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  resolution_note TEXT,
  resolution_by   UUID         REFERENCES public.admin_users(id),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_tickets_lead_idx
  ON public.service_tickets (lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS service_tickets_status_idx
  ON public.service_tickets (status, sla_due_at)
  WHERE status NOT IN ('RESOLVED', 'CLOSED');

-- ── conversation_events ───────────────────────────────────────────────────
-- Linha de tempo auditável de eventos por lead
CREATE TABLE IF NOT EXISTS public.conversation_events (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID         REFERENCES public.tenants(id),
  lead_id     UUID         REFERENCES public.leads(id) ON DELETE CASCADE,
  ticket_id   UUID         REFERENCES public.service_tickets(id),
  event_type  TEXT         NOT NULL,
  actor_type  TEXT         CHECK (actor_type IN ('CUSTOMER','LINO','SELLER','SUPERVISOR','SYSTEM')),
  actor_id    UUID,
  payload     JSONB,
  occurred_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_events_lead_idx
  ON public.conversation_events (lead_id, occurred_at DESC);

-- ── sla_policies ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sla_policies (
  id                     UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              UUID    REFERENCES public.tenants(id),
  name                   TEXT    NOT NULL,
  first_contact_minutes  INT     NOT NULL DEFAULT 30,
  grouping_window_minutes INT    NOT NULL DEFAULT 15,
  escalate_after_returns INT     NOT NULL DEFAULT 5,
  hard_escalate_minutes  INT     NOT NULL DEFAULT 240,
  timezone               TEXT    NOT NULL DEFAULT 'America/Sao_Paulo',
  work_schedule          JSONB   NOT NULL DEFAULT '{
    "mon": [["07:00","12:00"],["13:00","17:00"]],
    "tue": [["07:00","12:00"],["13:00","17:00"]],
    "wed": [["07:00","12:00"],["13:00","17:00"]],
    "thu": [["07:00","12:00"],["13:00","17:00"]],
    "fri": [["07:00","12:00"],["13:00","16:00"]],
    "sat": [],
    "sun": []
  }'::jsonb,
  holidays               JSONB   NOT NULL DEFAULT '[]'::jsonb,
  active                 BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Inserir política padrão se não existir
INSERT INTO public.sla_policies (name, first_contact_minutes, grouping_window_minutes, escalate_after_returns, hard_escalate_minutes)
SELECT 'Padrão Permetal', 30, 15, 5, 240
WHERE NOT EXISTS (SELECT 1 FROM public.sla_policies LIMIT 1);

-- ── Backfill de status ────────────────────────────────────────────────────
-- Normalizar status legados de forma segura (só atualiza se existir)
UPDATE public.leads SET status = 'CLOSED_WON'  WHERE status = 'WON';
UPDATE public.leads SET status = 'POST_SALE'   WHERE status IN ('POS_VENDA', 'FECHADO', 'CONVERTIDO');
UPDATE public.leads SET status = 'WAITING_SELLER' WHERE status = 'EM_ATENDIMENTO';

-- ── RLS básico ────────────────────────────────────────────────────────────
ALTER TABLE public.inbound_messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_tickets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_policies        ENABLE ROW LEVEL SECURITY;

-- Service role tem acesso irrestrito
CREATE POLICY IF NOT EXISTS "service_role_inbound"    ON public.inbound_messages    FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "service_role_outbound"   ON public.outbound_messages   FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "service_role_tickets"    ON public.service_tickets     FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "service_role_events"     ON public.conversation_events FOR ALL TO service_role USING (true);
CREATE POLICY IF NOT EXISTS "service_role_sla"        ON public.sla_policies        FOR ALL TO service_role USING (true);
