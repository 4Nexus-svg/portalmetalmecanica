CREATE TABLE IF NOT EXISTS public.companies (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT,
  city        TEXT,
  state       TEXT,
  phone       TEXT,
  site        TEXT,
  logo_url    TEXT,
  description TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies leitura publica"
  ON public.companies FOR SELECT USING (true);

CREATE POLICY "companies escrita painel"
  ON public.companies FOR ALL
  USING (public.user_role() IN ('admin','editor'))
  WITH CHECK (public.user_role() IN ('admin','editor'));

CREATE INDEX IF NOT EXISTS idx_companies_categoria ON public.companies (ativo, category);
