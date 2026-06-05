-- 010_featured_companies.sql — Fase 1: vitrine de empresas em destaque

CREATE TABLE IF NOT EXISTS public.featured_companies (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  logo_url    TEXT,
  link        TEXT,
  description TEXT,
  ordem       INTEGER NOT NULL DEFAULT 0,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  start_date  DATE,
  end_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.featured_companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "featured_companies leitura publica"
  ON public.featured_companies FOR SELECT USING (true);

CREATE POLICY "featured_companies escrita painel"
  ON public.featured_companies FOR ALL
  USING (public.user_role() IN ('admin','comercial'))
  WITH CHECK (public.user_role() IN ('admin','comercial'));

CREATE INDEX IF NOT EXISTS idx_featured_companies_ativo
  ON public.featured_companies (ativo, ordem);
