-- ========================================
-- RLS Policies para tabela instances
-- Execute no Supabase SQL Editor
-- Versão SEGURA - não remove políticas existentes
-- ========================================

DO $$
BEGIN
  -- Habilita RLS se não estiver
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'instances' AND rowsecurity = true) THEN
    ALTER TABLE public.instances ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Cria políticas apenas se não existirem
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permite select em instances' AND tablename = 'instances') THEN
    CREATE POLICY "Permite select em instances" ON public.instances FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permite insert em instances' AND tablename = 'instances') THEN
    CREATE POLICY "Permite insert em instances" ON public.instances FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permite update em instances' AND tablename = 'instances') THEN
    CREATE POLICY "Permite update em instances" ON public.instances FOR UPDATE USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permite delete em instances' AND tablename = 'instances') THEN
    CREATE POLICY "Permite delete em instances" ON public.instances FOR DELETE USING (true);
  END IF;
END $$;

-- Verifica políticas criadas
SELECT policyname, tablename FROM pg_policies WHERE tablename = 'instances';