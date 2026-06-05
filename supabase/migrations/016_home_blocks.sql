CREATE TABLE IF NOT EXISTS public.home_blocks (
  id     SERIAL PRIMARY KEY,
  key    TEXT NOT NULL UNIQUE,
  label  TEXT NOT NULL,
  coluna TEXT NOT NULL CHECK (coluna IN ('full','main','sidebar')),
  ordem  INTEGER NOT NULL DEFAULT 0,
  ativo  BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE public.home_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "home_blocks leitura publica"
  ON public.home_blocks FOR SELECT USING (true);

CREATE POLICY "home_blocks escrita painel"
  ON public.home_blocks FOR ALL
  USING (public.user_role() IN ('admin','editor'))
  WITH CHECK (public.user_role() IN ('admin','editor'));

INSERT INTO public.home_blocks (key, label, coluna, ordem, ativo) VALUES
  ('manchete',          'Manchete principal',   'full',    0, true),
  ('faixa_colunistas',  'Faixa de colunistas',  'full',    1, true),
  ('empresas_destaque', 'Empresas em destaque', 'full',    2, true),
  ('grid_noticias',     'Grade de notícias',    'main',    0, true),
  ('banner_between',    'Banner entre seções',  'main',    1, true),
  ('mais_noticias',     'Mais notícias',        'main',    2, true),
  ('banner_sidebar',    'Banner lateral',       'sidebar', 0, true),
  ('mais_lidas',        'Mais lidas',           'sidebar', 1, true),
  ('newsletter',        'Newsletter',           'sidebar', 2, true),
  ('assinar',           'Assine',               'sidebar', 3, true),
  ('canais_regionais',  'Canais regionais',     'sidebar', 4, true)
ON CONFLICT (key) DO NOTHING;
