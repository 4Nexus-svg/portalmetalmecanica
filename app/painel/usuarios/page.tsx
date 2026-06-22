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
  const { data: usuarios } = await supabase
    .from("profiles").select("*").order("created_at", { ascending: true }) as { data: Profile[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader titulo="Usuários" descricao="Usuários e papéis de acesso ao painel." />
      <UsuariosClient usuarios={usuarios ?? []} meuId={u.userId} />
    </div>
  );
}
