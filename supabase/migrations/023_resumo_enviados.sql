-- Notícias já enviadas no resumo do Telegram: evita repetir a mesma notícia
-- quando uma edição roda duas vezes (disparo manual, cron do GitHub atrasado).
CREATE TABLE IF NOT EXISTS public.resumo_enviados (
  slug text PRIMARY KEY,
  edicao text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.resumo_enviados DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.resumo_enviados TO service_role, anon, authenticated;
