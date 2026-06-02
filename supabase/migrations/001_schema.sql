-- Portal Metalmecanica - Schema completo

CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Perfis
CREATE TABLE public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email      TEXT,
  name       TEXT,
  cnpj       TEXT,
  role       TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Posts / Noticias
CREATE TABLE public.posts (
  id             SERIAL      PRIMARY KEY,
  slug           TEXT        UNIQUE NOT NULL,
  title          TEXT        NOT NULL,
  content        TEXT,
  excerpt        TEXT,
  featured_image TEXT,
  category       TEXT,
  region         TEXT        CHECK (region IN ('ES', 'MG', 'Brasil', 'Internacional')),
  author_id      UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  published_at   TIMESTAMPTZ,
  is_exclusive   BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_vector  TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('portuguese', coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' || coalesce(content,''))
  ) STORED
);

CREATE INDEX idx_posts_slug         ON public.posts(slug);
CREATE INDEX idx_posts_published_at ON public.posts(published_at DESC) WHERE published_at IS NOT NULL;
CREATE INDEX idx_posts_search       ON public.posts USING GIN(search_vector);

-- Classificados
CREATE TABLE public.classifieds (
  id                SERIAL      PRIMARY KEY,
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title             TEXT        NOT NULL,
  description       TEXT,
  price             DECIMAL(10,2),
  photos            TEXT[],
  city              TEXT,
  state             CHAR(2),
  category          TEXT,
  status            TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','expired','paid')),
  expires_at        TIMESTAMPTZ,
  payment_intent_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_classifieds_status     ON public.classifieds(status);
CREATE INDEX idx_classifieds_expires_at ON public.classifieds(expires_at);

-- Assinaturas
CREATE TABLE public.subscriptions (
  id                 TEXT        PRIMARY KEY,
  user_id            UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status             TEXT        NOT NULL CHECK (status IN ('active','trialing','past_due','canceled','unpaid')),
  plan               TEXT        NOT NULL CHECK (plan IN ('monthly','yearly')),
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status  ON public.subscriptions(status);

-- Banners
CREATE TABLE public.ads (
  id          SERIAL  PRIMARY KEY,
  name        TEXT,
  image_url   TEXT,
  link        TEXT,
  position    TEXT    CHECK (position IN ('top','sidebar','between','footer')),
  start_date  DATE,
  end_date    DATE,
  impressions INT     NOT NULL DEFAULT 0,
  clicks      INT     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Newsletter
CREATE TABLE public.subscribers (
  email      TEXT        PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger: criar profile ao registrar usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'));
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Funcao: expirar classificados
CREATE OR REPLACE FUNCTION public.expire_classifieds()
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.classifieds SET status = 'expired'
  WHERE status = 'active' AND expires_at < now();
$$;

-- RLS
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classifieds   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ads           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscribers   ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = auth.uid() AND status = 'active' AND current_period_end > now()
  );
$$;

-- Politicas PROFILES
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- Politicas POSTS
CREATE POLICY "posts_select" ON public.posts FOR SELECT
  USING (published_at IS NOT NULL AND (NOT is_exclusive OR public.has_active_subscription() OR public.is_admin()));
CREATE POLICY "posts_insert" ON public.posts FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "posts_update" ON public.posts FOR UPDATE USING (public.is_admin());
CREATE POLICY "posts_delete" ON public.posts FOR DELETE USING (public.is_admin());

-- Politicas CLASSIFIEDS
CREATE POLICY "classifieds_select" ON public.classifieds FOR SELECT
  USING (status = 'active' OR user_id = auth.uid() OR public.is_admin());
CREATE POLICY "classifieds_insert" ON public.classifieds FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
CREATE POLICY "classifieds_update" ON public.classifieds FOR UPDATE
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "classifieds_delete" ON public.classifieds FOR DELETE
  USING (user_id = auth.uid() OR public.is_admin());

-- Politicas SUBSCRIPTIONS
CREATE POLICY "subscriptions_select" ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "subscriptions_service_role" ON public.subscriptions
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Politicas ADS
CREATE POLICY "ads_select" ON public.ads FOR SELECT USING (true);
CREATE POLICY "ads_write"  ON public.ads FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Politicas SUBSCRIBERS
CREATE POLICY "subscribers_insert" ON public.subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "subscribers_select" ON public.subscribers FOR SELECT USING (public.is_admin());
