-- 020_storage_painel_roles.sql — Adiciona editor e colunista às políticas do bucket painel

DROP POLICY IF EXISTS "painel escrita painel" ON storage.objects;
DROP POLICY IF EXISTS "painel update painel" ON storage.objects;
DROP POLICY IF EXISTS "painel delete painel" ON storage.objects;

CREATE POLICY "painel escrita painel"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'painel' AND public.user_role() IN ('admin','editor','comercial','colunista'));

CREATE POLICY "painel update painel"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'painel' AND public.user_role() IN ('admin','editor','comercial','colunista'));

CREATE POLICY "painel delete painel"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'painel' AND public.user_role() IN ('admin','editor','comercial','colunista'));
