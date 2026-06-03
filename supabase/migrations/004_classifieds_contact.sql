-- Adiciona campos de contato aos classificados
ALTER TABLE public.classifieds
  ADD COLUMN IF NOT EXISTS phone     TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp  TEXT;

GRANT ALL ON public.classifieds TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.classifieds_id_seq TO service_role;
