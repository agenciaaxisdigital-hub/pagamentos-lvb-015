-- Adiciona coluna para vínculo entre lideranças
ALTER TABLE public.liderancas ADD COLUMN IF NOT EXISTS lideranca_vinculada_id uuid REFERENCES public.liderancas(id);

-- Comentário para documentação
COMMENT ON COLUMN public.liderancas.lideranca_vinculada_id IS 'ID de outra liderança caso esta esteja vinculada a ela em vez de a um suplente';
