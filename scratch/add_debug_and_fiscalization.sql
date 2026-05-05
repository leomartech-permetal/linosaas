-- ======================================================
-- CONFIGURAÇÕES EXPRESS, DEBUG LOGS E FISCALIZAÇÃO
-- ======================================================

-- 1. TABELA DE REGRAS DE NEGÓCIO (EXPRESS E OUTROS)
CREATE TABLE IF NOT EXISTS public.business_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_key VARCHAR(100) UNIQUE NOT NULL, -- 'express_permetal', 'express_metalgrade'
    description TEXT,
    config JSONB NOT NULL, -- { max_m2: 30, max_pcs_2x1: 15, exclusions: ['belinox'] }
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA DE LOGS DE ERRO E DEBUG (lino-debugger)
CREATE TABLE IF NOT EXISTS public.debug_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level VARCHAR(20) DEFAULT 'INFO', -- 'INFO', 'WARN', 'ERROR', 'DEBUG'
    module VARCHAR(50), -- 'webhook', 'router', 'openai', 'support'
    action VARCHAR(100),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA DE AUDITORIA DE ATENDIMENTO (lino-support-fiscalization)
CREATE TABLE IF NOT EXISTS public.attendance_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    audit_type VARCHAR(50), -- 'SLA_BREACH', 'QUALITY_ISSUE', 'GARGALO'
    severity VARCHAR(20), -- 'low', 'medium', 'high', 'critical'
    description TEXT,
    evidence JSONB,
    status VARCHAR(20) DEFAULT 'OPEN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. INSERIR REGRAS PADRÃO DA EXPRESS (CONFORME SOLICITADO)
INSERT INTO public.business_rules (rule_key, description, config)
VALUES 
('express_permetal', 'Regras para Permetal Express', '{
    "max_m2": 30,
    "max_pcs_2x1": 15,
    "max_pcs_3x1": 10,
    "exclusions": ["antiofuscante", "belinox"]
}'),
('express_metalgrade', 'Regras para Metalgrade Express', '{
    "max_m_lineares": 30,
    "exclusions": ["degraus", "grades de piso"]
}')
ON CONFLICT (rule_key) DO UPDATE SET config = EXCLUDED.config;

-- 5. DESABILITAR RLS PARA NOVAS TABELAS
ALTER TABLE public.business_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.debug_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_audits DISABLE ROW LEVEL SECURITY;

-- 6. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_debug_logs_module ON public.debug_logs(module);
CREATE INDEX IF NOT EXISTS idx_debug_logs_created ON public.debug_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audits_lead ON public.attendance_audits(lead_id);
