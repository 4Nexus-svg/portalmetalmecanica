import { createClient } from "@/lib/supabase/server";
import { rolePainel, podeAcessar, type Role, type Secao } from "./permissions";

/** Retorna o usuário de painel autenticado (id + role) ou null. */
export async function getPainelUser(): Promise<{ userId: string; role: Role } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle() as { data: { role: string } | null; error: unknown };
  const role = rolePainel(profile?.role);
  if (!role) return null;
  return { userId: user.id, role };
}

/** Garante que o usuário pode acessar a seção; lança erro se não. Use em Server Actions. */
export async function exigirSecao(secao: Secao): Promise<{ userId: string; role: Role }> {
  const u = await getPainelUser();
  if (!u || !podeAcessar(u.role, secao)) {
    throw new Error("Não autorizado");
  }
  return u;
}
