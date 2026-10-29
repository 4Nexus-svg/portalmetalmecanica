-- Notícias já enviadas no resumo do Telegram: evita repetir a mesma notícia
-- quando uma edição roda duas vezes (disparo manual, cron do GitHub atrasado).
CREATE TABLE IF NOT EXISTS public.resumo_enviados (
  slug text PRIMARY KEY,
  edicao text NOT NULL,
  enviado_em timestamptz NOT NULL DEFAULT now()
);

-- Só a rota do resumo (service_role) usa esta tabela: RLS ligada sem policies
-- e sem acesso pra anon/authenticated, pra a chave pública não ler nem alterar.
ALTER TABLE public.resumo_enviados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.resumo_enviados FROM anon, authenticated;
GRANT ALL ON TABLE public.resumo_enviados TO service_role;
