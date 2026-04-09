ALTER TABLE public.administrativo ADD COLUMN IF NOT EXISTS contrato_ate_mes integer DEFAULT 10;
ALTER TABLE public.liderancas ADD COLUMN IF NOT EXISTS retirada_ate_mes integer DEFAULT 10;