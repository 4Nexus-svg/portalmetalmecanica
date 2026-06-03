-- Grants para a tabela ads (leitura pública para exibição de banners)
GRANT SELECT ON public.ads TO anon, authenticated;
GRANT ALL    ON public.ads TO service_role;
