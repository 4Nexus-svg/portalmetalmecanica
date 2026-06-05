CREATE TABLE IF NOT EXISTS public.articles (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  content      TEXT,
  excerpt      TEXT,
  cover_url    TEXT,
  columnist_id INTEGER NOT NULL REFERENCES public.columnists(id) ON DELETE CASCADE,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "articles leitura publica"
  ON public.articles FOR SELECT
  USING (published_at IS NOT NULL);

CREATE POLICY "articles escrita painel"
  ON public.articles FOR ALL
  USING (
    public.user_role() IN ('admin','editor')
    OR EXISTS (SELECT 1 FROM public.columnists c WHERE c.id = articles.columnist_id AND c.profile_id = auth.uid())
  )
  WITH CHECK (
    public.user_role() IN ('admin','editor')
    OR EXISTS (SELECT 1 FROM public.columnists c WHERE c.id = articles.columnist_id AND c.profile_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_articles_columnist ON public.articles (columnist_id);
CREATE INDEX IF NOT EXISTS idx_articles_published ON public.articles (published_at);
