import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import ColunistasClient from "./ColunistasClient";
import { columnistIdDoUsuario } from "./actions";
import type { Database } from "@/types/database";

type Colunista = Database["public"]["Tables"]["columnists"]["Row"];
type Artigo = Database["public"]["Tables"]["articles"]["Row"];

export default async function ColunistasPainelPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "colunistas")) redirect("/painel");

  const ehGestor = u.role === "admin" || u.role === "editor";
  const supabase = await createClient();
  const svcClient = await createServiceClient();

  const { data: colunistas } = await supabase
    .from("columnists").select("*").order("nome", { ascending: true }) as { data: Colunista[] | null; error: unknown };

  const meuColunistaId = ehGestor ? null : await columnistIdDoUsuario(u.userId);

  let query = (svcClient.from("articles") as any).select("*");
  if (!ehGestor) query = query.eq("columnist_id", meuColunistaId ?? -1);
  const { data: artigos } = await query.order("created_at", { ascending: false }) as { data: Artigo[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader titulo="Colunistas" descricao="Colunistas e seus artigos de opinião." />
      <ColunistasClient
        role={u.role}
        colunistas={colunistas ?? []}
        artigos={artigos ?? []}
        meuColunistaId={meuColunistaId}
      />
    </div>
  );
}
