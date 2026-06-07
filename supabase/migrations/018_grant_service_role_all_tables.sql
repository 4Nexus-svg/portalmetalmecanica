-- Concede permissões ao service_role em todas as tabelas usadas pelas server actions do painel
GRANT ALL ON public.articles TO service_role;
GRANT ALL ON public.classifieds TO service_role;
GRANT ALL ON public.jobs TO service_role;
GRANT ALL ON public.companies TO service_role;
GRANT ALL ON public.home_blocks TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
