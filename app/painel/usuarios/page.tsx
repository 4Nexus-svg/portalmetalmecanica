import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import UsuariosClient from "./UsuariosClient";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function UsuariosPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "usuarios")) redirect("/painel");

  const supabase = await createClient();
  const [{ data: usuarios }, { data: colunistas }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }) as unknown as Promise<{ data: Profile[] | null; error: unknown }>,
    (supabase.from("columnists") as any).select("profile_id, nome").not("profile_id", "is", null),
  ]);

  const nomeColunista: Record<string, string> = {};
  for (const c of colunistas ?? []) {
    if (c.profile_id) nomeColunista[c.profile_id] = c.nome;
  }

  return (
    <div>
      <SecaoHeader titulo="Usuários" descricao="Usuários e papéis de acesso ao painel." />
      <UsuariosClient usuarios={usuarios ?? []} meuId={u.userId} nomeColunista={nomeColunista} />
    </div>
  );
}
