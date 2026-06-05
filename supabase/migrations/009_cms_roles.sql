-- 009_cms_roles.sql — Fase 0 do CMS: expande papéis de usuário

-- Expande os papéis de usuário aceitos
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'editor', 'comercial', 'colunista', 'user'));

-- Vincula colunista do painel ao registro público em columnists (usado na Fase 2)
ALTER TABLE public.columnists ADD COLUMN IF NOT EXISTS profile_id UUID
  REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Helper de papel (base das RLS das fases seguintes)
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;
