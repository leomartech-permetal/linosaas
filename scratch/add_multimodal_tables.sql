-- Tabelas para o Sistema Multimodal e Buffer
CREATE TABLE IF NOT EXISTS public.media_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    media_type VARCHAR(50), -- 'image', 'audio', 'document'
    url TEXT,
    analysis TEXT, -- Descrição da imagem ou transcrição do áudio
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.conversation_buffers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    content TEXT,
    media_attachment_id UUID REFERENCES public.media_attachments(id),
    processed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar flag de intervenção humana na tabela de leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS bot_active BOOLEAN DEFAULT true;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS last_bot_interaction_at TIMESTAMP WITH TIME ZONE;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_buffer_lead_unprocessed ON public.conversation_buffers(lead_id) WHERE processed = false;
