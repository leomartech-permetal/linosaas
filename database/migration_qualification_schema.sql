-- Migration: add_qualification_schema
-- Adiciona suporte a schemas de qualificação por produto e estado de qualificação por lead

-- 1. Tabela de produtos: adiciona o schema de qualificação configurável
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS qualification_schema JSONB DEFAULT '{"obrigatorias": ["empresa", "email", "quantidade"], "opcionais": []}'::jsonb;

-- 2. Tabela de leads: adiciona o estado de qualificação persistente
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS qualification_state JSONB DEFAULT '{"obrigatorias": {}, "opcionais": {}}'::jsonb;

-- Comentários para documentação das colunas no Supabase
COMMENT ON COLUMN products.qualification_schema IS 'Configuração de campos obrigatórios e opcionais com limite de tentativas de coleta.';
COMMENT ON COLUMN leads.qualification_state IS 'Estado atual de preenchimento das variáveis e contadores de tentativas por campo.';
