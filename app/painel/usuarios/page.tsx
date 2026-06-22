import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import UsuariosClient from "./UsuariosClient";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Colunista = Database["public"]["Tables"]["columnists"]["Row"];

export default async function UsuariosPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "usuarios")) redirect("/painel");

  const supabase = await createClient();
  const [{ data: usuarios }, { data: colunistasLivres }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }) as Promise<{ data: Profile[] | null }>,
    (supabase.from("columnists") as any).select("id, nome").is("profile_id", null).order("nome") as Promise<{ data: Pick<Colunista, "id" | "nome">[] | null }>,
  ]);

  return (
    <div>
      <SecaoHeader titulo="Usuários" descricao="Usuários e papéis de acesso ao painel." />
      <UsuariosClient usuarios={usuarios ?? []} meuId={u.userId} colunistasLivres={colunistasLivres ?? []} />
    </div>
  );
}
