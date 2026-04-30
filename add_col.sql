ALTER TABLE public.tenant_config ADD COLUMN IF NOT EXISTS bot_active BOOLEAN DEFAULT true;
