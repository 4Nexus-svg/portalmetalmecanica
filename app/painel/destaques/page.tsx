import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import DestaquesClient from "./DestaquesClient";
import type { Database } from "@/types/database";

type Destaque = Database["public"]["Tables"]["featured_companies"]["Row"];

export default async function DestaquesPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "destaques")) redirect("/painel");

  const supabase = await createClient();
  const { data: itens } = await supabase
    .from("featured_companies").select("*").order("ordem", { ascending: true }) as { data: Destaque[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader titulo="Empresas em Destaque" descricao="Empresas em destaque exibidas no portal." />
      <DestaquesClient itens={itens ?? []} />
    </div>
  );
}
