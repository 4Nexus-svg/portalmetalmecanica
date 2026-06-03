-- Garante permissões ao service_role para operações do pipeline automático
GRANT ALL ON public.posts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.posts_id_seq TO service_role;
