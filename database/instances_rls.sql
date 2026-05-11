-- ========================================
-- RLS Policies para tabela instances
-- Execute no Supabase SQL Editor
-- ========================================

-- Habilita RLS (se não estiver habilitado)
ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;

-- Remove políticas existentes (se houver)
DROP POLICY IF EXISTS "Permite insert em instances" ON public.instances;
DROP POLICY IF EXISTS "Permite update em instances" ON public.instances;
DROP POLICY IF EXISTS "Permite delete em instances" ON public.instances;
DROP POLICY IF EXISTS "Permite select em instances" ON public.instances;

-- Cria políticas permissivas (para dev/teste - depois você pode restringir)
CREATE POLICY "Permite select em instances" ON public.instances
FOR SELECT USING (true);

CREATE POLICY "Permite insert em instances" ON public.instances
FOR INSERT WITH CHECK (true);

CREATE POLICY "Permite update em instances" ON public.instances
FOR UPDATE USING (true);

CREATE POLICY "Permite delete em instances" ON public.instances
FOR DELETE USING (true);

-- Verifica se foi criado
SELECT policyname, tablename FROM pg_policies WHERE tablename = 'instances';