-- Tabelas novas para o sistema funcionar 100%
CREATE TABLE IF NOT EXISTS public.skills (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL, type VARCHAR(50) DEFAULT 'product', prompt TEXT NOT NULL, active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.admin_users (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL, email VARCHAR(255) NOT NULL, password VARCHAR(255) NOT NULL, role VARCHAR(50) DEFAULT 'vendedor', active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.tenant_config (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), company_name VARCHAR(255) DEFAULT 'LINO CRM', company_subtitle VARCHAR(255) DEFAULT 'Grupo Permetal', primary_color VARCHAR(50) DEFAULT '#0ecab2', secondary_color VARCHAR(50) DEFAULT '#087f71', bg_type VARCHAR(50) DEFAULT 'texture', bg_color1 VARCHAR(50) DEFAULT '#0a0a0a', bg_color2 VARCHAR(50) DEFAULT '#1a1a1a', bg_opacity REAL DEFAULT 0.2, logo_url TEXT, texture_url TEXT, evolution_url TEXT, evolution_key TEXT, openai_key TEXT, admin_password VARCHAR(255) DEFAULT 'permetal2026', master_prompt TEXT DEFAULT 'Voce e Lino vendedor tecnico especialista em chapas perfuradas.', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.instances (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(255) NOT NULL, phone_number VARCHAR(50), evolution_instance_name VARCHAR(255), evolution_url TEXT, evolution_key TEXT, assigned_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, active BOOLEAN DEFAULT true, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());

-- === LINO SUPORTE: Tabelas de Equipes e Monitoramento ===
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  tenant_id UUID,
  supervisor_name VARCHAR(255),
  supervisor_phone VARCHAR(50),
  supervisor_email VARCHAR(255),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lead_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  assigned_user_id UUID,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  attempt_number INTEGER DEFAULT 1,
  notified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded BOOLEAN DEFAULT false,
  response_detected_at TIMESTAMP WITH TIME ZONE,
  escalated_to_supervisor BOOLEAN DEFAULT false,
  escalated_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar team_id aos admin_users para vincular vendedor à equipe
ALTER TABLE public.admin_users ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

ALTER TABLE public.skills DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.instances DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_follow_ups DISABLE ROW LEVEL SECURITY;

INSERT INTO public.tenant_config (company_name, company_subtitle) SELECT 'LINO CRM', 'Grupo Permetal' WHERE NOT EXISTS (SELECT 1 FROM public.tenant_config LIMIT 1);
INSERT INTO public.admin_users (name, email, password, role) SELECT 'Administrador', 'admin@lino.com', 'permetal2026', 'admin' WHERE NOT EXISTS (SELECT 1 FROM public.admin_users LIMIT 1);
