CREATE TABLE IF NOT EXISTS public.site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_settings leitura publica"
  ON public.site_settings FOR SELECT USING (true);

CREATE POLICY "site_settings escrita admin"
  ON public.site_settings FOR ALL
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;

INSERT INTO public.site_settings (key, value) VALUES
  ('site_name', 'Portal MetalMecânica'),
  ('contact_email', ''),
  ('contact_phone', ''),
  ('social_instagram', ''),
  ('social_linkedin', ''),
  ('social_youtube', ''),
  ('subscription_price', '290')
ON CONFLICT (key) DO NOTHING;
