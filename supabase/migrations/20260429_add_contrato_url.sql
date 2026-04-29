-- Adiciona coluna para URL do contrato PDF na tabela administrativo
ALTER TABLE public.administrativo ADD COLUMN IF NOT EXISTS contrato_url text DEFAULT NULL;

-- Comentário para documentação
COMMENT ON COLUMN public.administrativo.contrato_url IS 'URL do arquivo de contrato (PDF) armazenado no Supabase Storage';

-- ─── Configuração do Storage ──────────────────────────────────────────────────
-- Cria o bucket 'documentos' se não existir
INSERT INTO storage.buckets (id, name, public) 
VALUES ('documentos', 'documentos', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso para o bucket 'documentos'
-- Permitir que usuários autenticados façam upload
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated Upload' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public View' AND tablename = 'objects' AND schemaname = 'storage'
    ) THEN
        CREATE POLICY "Public View" ON storage.objects FOR SELECT TO public USING (bucket_id = 'documentos');
    END IF;
END $$;
