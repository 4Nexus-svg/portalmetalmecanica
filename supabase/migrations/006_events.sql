CREATE TABLE public.events (
  id          SERIAL      PRIMARY KEY,
  slug        TEXT        UNIQUE NOT NULL,
  title       TEXT        NOT NULL,
  description TEXT,
  type        TEXT        NOT NULL CHECK (type IN ('feira','congresso','seminario','workshop','treinamento')),
  date_start  DATE        NOT NULL,
  date_end    DATE,
  city        TEXT,
  state       TEXT        CHECK (state IN ('ES','MG','Brasil','Internacional')),
  organizer   TEXT,
  image_url   TEXT,
  is_auto     BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_date_start ON public.events(date_start);
CREATE INDEX idx_events_type       ON public.events(type);
CREATE INDEX idx_events_state      ON public.events(state);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select" ON public.events FOR SELECT USING (true);
CREATE POLICY "events_write"  ON public.events FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.events TO anon, authenticated;
GRANT ALL    ON public.events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.events_id_seq TO service_role;
