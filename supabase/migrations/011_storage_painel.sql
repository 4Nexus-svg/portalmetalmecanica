-- 011_storage_painel.sql — Fase 1: bucket de imagens do painel

INSERT INTO storage.buckets (id, name, public)
VALUES ('painel', 'painel', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "painel leitura publica"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'painel');

CREATE POLICY "painel escrita painel"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'painel' AND public.user_role() IN ('admin','comercial'));

CREATE POLICY "painel update painel"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'painel' AND public.user_role() IN ('admin','comercial'));

CREATE POLICY "painel delete painel"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'painel' AND public.user_role() IN ('admin','comercial'));
