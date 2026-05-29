-- Add pausado column to administrativo, liderancas, and suplentes tables
ALTER TABLE public.administrativo ADD COLUMN IF NOT EXISTS pausado boolean DEFAULT false;
ALTER TABLE public.liderancas ADD COLUMN IF NOT EXISTS pausado boolean DEFAULT false;
ALTER TABLE public.suplentes ADD COLUMN IF NOT EXISTS pausado boolean DEFAULT false;
