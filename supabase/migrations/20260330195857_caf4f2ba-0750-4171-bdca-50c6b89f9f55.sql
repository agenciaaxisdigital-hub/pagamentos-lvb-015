-- Create liderancas table
CREATE TABLE IF NOT EXISTS public.liderancas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf text DEFAULT NULL,
  regiao text DEFAULT NULL,
  whatsapp text DEFAULT NULL,
  rede_social text DEFAULT NULL,
  ligacao_politica text DEFAULT NULL,
  retirada_mensal_valor numeric DEFAULT 0,
  chave_pix text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.liderancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read liderancas" ON public.liderancas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert liderancas" ON public.liderancas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update liderancas" ON public.liderancas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete liderancas" ON public.liderancas FOR DELETE TO authenticated USING (true);

-- Create administrativo table
CREATE TABLE IF NOT EXISTS public.administrativo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf text DEFAULT NULL,
  whatsapp text DEFAULT NULL,
  valor_contrato numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.administrativo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read administrativo" ON public.administrativo FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert administrativo" ON public.administrativo FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update administrativo" ON public.administrativo FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete administrativo" ON public.administrativo FOR DELETE TO authenticated USING (true);

-- Add missing columns to pagamentos table
ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS tipo_pessoa text DEFAULT 'suplente',
  ADD COLUMN IF NOT EXISTS lideranca_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS admin_id uuid DEFAULT NULL;

-- Add missing columns to suplentes table
ALTER TABLE public.suplentes
  ADD COLUMN IF NOT EXISTS numero_urna text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bairro text DEFAULT NULL;

-- Make suplente_id nullable in pagamentos (since lideranca/admin payments don't have it)
ALTER TABLE public.pagamentos ALTER COLUMN suplente_id DROP NOT NULL;