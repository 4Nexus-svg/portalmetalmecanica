CREATE TABLE IF NOT EXISTS public.jobs (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  company       TEXT,
  city          TEXT,
  state         TEXT,
  type          TEXT,
  salary        TEXT,
  description   TEXT,
  link          TEXT,
  contact_email TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at    DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs leitura publica"
  ON public.jobs FOR SELECT USING (true);

CREATE POLICY "jobs escrita painel"
  ON public.jobs FOR ALL
  USING (public.user_role() IN ('admin','editor'))
  WITH CHECK (public.user_role() IN ('admin','editor'));

CREATE INDEX IF NOT EXISTS idx_jobs_ativo ON public.jobs (ativo, expires_at);
