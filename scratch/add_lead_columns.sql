-- Adicionando colunas para captura de variáveis do SDR
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS company VARCHAR(255),
  ADD COLUMN IF NOT EXISTS detected_product VARCHAR(255),
  ADD COLUMN IF NOT EXISTS detected_ddd VARCHAR(10),
  ADD COLUMN IF NOT EXISTS detected_city VARCHAR(255),
  ADD COLUMN IF NOT EXISTS detected_qty VARCHAR(255),
  ADD COLUMN IF NOT EXISTS detected_material VARCHAR(255);

-- Comentários para documentação
COMMENT ON COLUMN public.leads.detected_product IS 'Produto identificado pela IA durante a qualificação';
COMMENT ON COLUMN public.leads.detected_ddd IS 'DDD identificado pela IA';
