-- Concede permissões ao service_role na tabela licitacoes_pncp
-- (tabela criada manualmente antes desta migration existir)
GRANT ALL ON public.licitacoes_pncp TO service_role;
