-- Função eh_super_admin (wrapper)
CREATE OR REPLACE FUNCTION public.eh_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Tabela municípios
CREATE TABLE IF NOT EXISTS public.municipios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  uf text NOT NULL DEFAULT 'GO',
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.municipios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem municipios" ON public.municipios
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin gerencia municipios" ON public.municipios
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Inserir Goiânia como cidade padrão
INSERT INTO public.municipios (nome, uf) VALUES ('Goiânia', 'GO');

-- Adicionar municipio_id nas tabelas existentes
ALTER TABLE public.suplentes ADD COLUMN IF NOT EXISTS municipio_id uuid REFERENCES public.municipios(id);
ALTER TABLE public.liderancas ADD COLUMN IF NOT EXISTS municipio_id uuid REFERENCES public.municipios(id);
ALTER TABLE public.administrativo ADD COLUMN IF NOT EXISTS municipio_id uuid REFERENCES public.municipios(id);
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS municipio_id uuid REFERENCES public.municipios(id);

-- Tabela suplente_municipio (N:N)
CREATE TABLE IF NOT EXISTS public.suplente_municipio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suplente_id uuid NOT NULL REFERENCES public.suplentes(id) ON DELETE CASCADE,
  municipio_id uuid NOT NULL REFERENCES public.municipios(id) ON DELETE CASCADE,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(suplente_id, municipio_id)
);

ALTER TABLE public.suplente_municipio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados veem suplente_municipio" ON public.suplente_municipio
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin gerencia suplente_municipio" ON public.suplente_municipio
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Vincular registros existentes a Goiânia
UPDATE public.suplentes SET municipio_id = (SELECT id FROM public.municipios WHERE nome = 'Goiânia' LIMIT 1) WHERE municipio_id IS NULL;
UPDATE public.liderancas SET municipio_id = (SELECT id FROM public.municipios WHERE nome = 'Goiânia' LIMIT 1) WHERE municipio_id IS NULL;
UPDATE public.administrativo SET municipio_id = (SELECT id FROM public.municipios WHERE nome = 'Goiânia' LIMIT 1) WHERE municipio_id IS NULL;
