-- ==========================================
-- SINCRONIZAÇÃO LINO SUPORTE & DB SCHEMA
-- ==========================================

-- 1. GARANTIR COLUNAS NA TABELA TEAMS
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS supervisor_name VARCHAR(255);
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS supervisor_phone VARCHAR(50);
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS supervisor_email VARCHAR(255);

-- 2. GARANTIR COLUNAS NA TABELA ADMIN_USERS
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(50);

-- 3. GARANTIR COLUNAS DE TIMESTAMP NA TABELA LEADS
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sent_to_seller_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS seller_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS attendance_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS detected_product VARCHAR(255);
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS detected_ddd VARCHAR(10);

-- 4. GARANTIR COLUNAS NA TABELA LEAD_FOLLOW_UPS
ALTER TABLE public.lead_follow_ups ADD COLUMN IF NOT EXISTS client_return_count INTEGER DEFAULT 0;
ALTER TABLE public.lead_follow_ups ADD COLUMN IF NOT EXISTS last_client_message_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.lead_follow_ups ADD COLUMN IF NOT EXISTS time_since_sent_hours REAL;

-- 5. CRIAR TABELA DE ESCALAÇÕES (SE NÃO EXISTIR)
CREATE TABLE IF NOT EXISTS public.supervisor_escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
    team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
    escalation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. CRIAR TABELA DE GARGALOS (SE NÃO EXISTIR)
CREATE TABLE IF NOT EXISTS public.attendance_bottlenecks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    bottleneck_type VARCHAR(50), -- 'NO_RESPONSE', 'CLIENT_RETURNED'
    severity VARCHAR(50), -- 'medium', 'high', 'critical'
    description TEXT,
    hours_waited REAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. CRIAR TABELA DE HISTÓRICO DE STATUS (SE NÃO EXISTIR)
CREATE TABLE IF NOT EXISTS public.lead_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50),
    changed_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. NOTA: A compatibilidade via VIEW foi removida para evitar conflito com a tabela 'users' existente.
-- O código do sistema será atualizado para usar 'admin_users' diretamente.

-- 9. DESABILITAR RLS PARA AS NOVAS TABELAS (CONFORME PADRÃO DO PROJETO)
ALTER TABLE public.supervisor_escalations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_bottlenecks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_status_history DISABLE ROW LEVEL SECURITY;

-- 10. NOTA: Após rodar, o cache do schema no Supabase/PostgREST 
-- deve ser atualizado automaticamente em alguns segundos.
