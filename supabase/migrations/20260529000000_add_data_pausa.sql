-- Add data_pausa column to public.suplentes, public.liderancas, and public.administrativo tables
ALTER TABLE public.suplentes ADD COLUMN IF NOT EXISTS data_pausa timestamp with time zone;
ALTER TABLE public.liderancas ADD COLUMN IF NOT EXISTS data_pausa timestamp with time zone;
ALTER TABLE public.administrativo ADD COLUMN IF NOT EXISTS data_pausa timestamp with time zone;
