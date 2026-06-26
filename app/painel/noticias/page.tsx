import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import NoticiasClient from "./NoticiasClient";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["posts"]["Row"];

export default async function NoticiasPainelPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "noticias")) redirect("/painel");

  const supabase = await createClient();
  const { data: itens } = await supabase
    .from("posts")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(4) as { data: Post[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader
        titulo="Notícias"
        descricao="Edite as 4 últimas notícias publicadas ou crie uma nova manualmente."
      />
      <NoticiasClient itens={itens ?? []} />
    </div>
  );
}
