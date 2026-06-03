-- Pipeline automático de notícias: colunas de rastreamento de fonte
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS fonte_url  TEXT,
  ADD COLUMN IF NOT EXISTS fonte_nome TEXT,
  ADD COLUMN IF NOT EXISTS is_auto    BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_posts_fonte_url ON public.posts(fonte_url)
  WHERE fonte_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_is_auto ON public.posts(is_auto)
  WHERE is_auto = true;
