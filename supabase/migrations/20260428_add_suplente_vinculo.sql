ALTER TABLE public.suplentes ADD COLUMN IF NOT EXISTS vinculado_id uuid REFERENCES public.suplentes(id);
ALTER TABLE public.liderancas ADD COLUMN IF NOT EXISTS suplente_id uuid REFERENCES public.suplentes(id);
ALTER TABLE public.administrativo ADD COLUMN IF NOT EXISTS suplente_id uuid REFERENCES public.suplentes(id);
