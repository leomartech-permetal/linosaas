-- =============================================
-- MIGRATION: Roteamento Comercial Completo
-- =============================================

-- 1. REGIÕES com DDDs
CREATE TABLE IF NOT EXISTS public.regions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    ddd_codes TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.regions DISABLE ROW LEVEL SECURITY;

-- 2. SEGMENTOS com keywords
CREATE TABLE IF NOT EXISTS public.segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    keywords TEXT[] DEFAULT '{}',
    collection_type VARCHAR(20) DEFAULT 'normal',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.segments DISABLE ROW LEVEL SECURITY;

-- 3. PRODUTOS com sinônimos e vínculo de marca
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    synonyms TEXT[] DEFAULT '{}',
    brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL,
    express_max_qty VARCHAR(255),
    is_express_eligible BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;

-- 4. Adicionar colunas na routing_rules
ALTER TABLE public.routing_rules 
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES public.segments(id) ON DELETE SET NULL;

-- =============================================
-- SEED: Regiões
-- =============================================
INSERT INTO public.regions (name, ddd_codes) VALUES
('CENTRO_OESTE', ARRAY['61','62','64','65','66','67']),
('NORDESTE', ARRAY['71','73','74','75','77','79','81','82','83','84','85','86','87','88','89','98','99']),
('NORTE', ARRAY['63','68','69','91','92','93','94','95','96','97']),
('MG', ARRAY['31','32','33','34','35','36','37','38']),
('RJ', ARRAY['21','22','24']),
('ES', ARRAY['27','28']),
('SUL', ARRAY['41','42','43','44','45','46','47','48','49','51','53','54','55']),
('SP01', ARRAY['11','12','13','15']),
('SP02', ARRAY['14','16','17','18','19'])
ON CONFLICT DO NOTHING;

-- =============================================
-- SEED: Segmentos
-- =============================================
INSERT INTO public.segments (name, keywords, collection_type) VALUES
('Indústria', ARRAY['industria','industrial','máquina','maquina','equipamento','fábrica','fabrica'], 'normal'),
('Construção', ARRAY['construção','construcao','obra','reforma','construtora','serralheiro','serralheria','vidraceiro','esquadria','empreiteiro','empreita','arquitetura','arquiteto','prefeitura','licitação','licitacao'], 'normal'),
('Revenda', ARRAY['revenda','revender','revendedor','distribuidor'], 'short'),
('Belinox', ARRAY['belinox','belaco','belaço','chapa moeda','bobina moeda','tela moeda'], 'short'),
('Antiofuscante', ARRAY['antiofuscante','anti-ofuscante','anti ofuscante'], 'short')
ON CONFLICT DO NOTHING;

-- =============================================
-- SEED: Marcas (se não existirem)
-- =============================================
INSERT INTO public.brands (name) 
SELECT name FROM (VALUES ('PSA PERMETAL'), ('METALGRADE'), ('PERMETAL'), ('PERMETAL EXPRESS')) AS v(name)
WHERE NOT EXISTS (SELECT 1 FROM public.brands WHERE LOWER(brands.name) = LOWER(v.name));

-- =============================================
-- SEED: Produtos com sinônimos e marca
-- =============================================
INSERT INTO public.products (name, synonyms, brand_id, express_max_qty, is_express_eligible)
SELECT p.name, p.synonyms, b.id, p.express_max_qty, p.is_express_eligible
FROM (VALUES
  ('Chapa Perfurada', ARRAY['chapa furada','perfurada','chapa com furos','chapa perfurado'], 'PERMETAL', 'até 10 peças ou 20m2', true),
  ('Chapa Expandida', ARRAY['expandida','chapa expandido','metal expandido'], 'PERMETAL', 'até 10 peças ou 20m2', true),
  ('Tela Expandida', ARRAY['tela expandido','tela de aço expandida'], 'PERMETAL', 'até 10 peças', true),
  ('Piso Industrial', ARRAY['piso metalico','piso de aço','piso metal','piso metálico'], 'METALGRADE', 'até 10m2', true),
  ('Grade de Piso', ARRAY['grade piso','grating','grade metalica','grade metálica'], 'METALGRADE', 'até 10m linear', true),
  ('Gradil Metálico', ARRAY['gradil','orsograde','gradil artis','gradil stadium','gradil leve','gradil de ferro','gradil metalico'], 'METALGRADE', 'até 10m linear', true),
  ('Portão Gradil', ARRAY['portão gradil','portao gradil','portão metalgrade','portao metalgrade'], 'METALGRADE', 'até 2 unidades', true),
  ('Degrau em Grade de Piso', ARRAY['degrau grade','degrau metalico','degrau metálico','degrau grade piso'], 'METALGRADE', 'até 10 unidades', true),
  ('Bobina Moeda / Belinox', ARRAY['bobina moeda','tela moeda','belinox','belaço','belaco','chapa moeda'], 'PERMETAL', NULL, false),
  ('Chapa Recalcada', ARRAY['recalcada','chapa recalcado','metal recalcado'], 'PERMETAL', 'até 10 peças', true),
  ('Tela Antiofuscante', ARRAY['antiofuscante','tela anti ofuscante','anti-ofuscante'], 'PERMETAL', NULL, false),
  ('Fachada Metálica', ARRAY['fachada','fachada metalica','revestimento metálico','revestimento metalico','painel arquitetônico'], 'PSA PERMETAL', NULL, false),
  ('Forro Metálico', ARRAY['forro','forro metalico','forro metálico'], 'PSA PERMETAL', NULL, false),
  ('Brise Metálico', ARRAY['brise','brise apolo','brise metalico','brise metálico'], 'PSA PERMETAL', NULL, false),
  ('Painel Perfurado / Brise Artemis', ARRAY['painel perfurado','brise artemis','painel artemis'], 'PSA PERMETAL', NULL, false)
) AS p(name, synonyms, express_max_qty, is_express_eligible, dummy)
LEFT JOIN public.brands b ON LOWER(b.name) = LOWER(p.dummy::text)
WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE LOWER(products.name) = LOWER(p.name));
