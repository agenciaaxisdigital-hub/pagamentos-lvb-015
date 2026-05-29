-- Add dia_vencimento column to administrativo, liderancas, and suplentes tables
ALTER TABLE public.administrativo ADD COLUMN IF NOT EXISTS dia_vencimento integer DEFAULT 10;
ALTER TABLE public.liderancas ADD COLUMN IF NOT EXISTS dia_vencimento integer DEFAULT 10;
ALTER TABLE public.suplentes ADD COLUMN IF NOT EXISTS dia_vencimento integer DEFAULT 10;
