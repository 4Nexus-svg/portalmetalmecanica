import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import PublicidadeClient from "./PublicidadeClient";
import type { Database } from "@/types/database";

type Ad = Database["public"]["Tables"]["ads"]["Row"];

export default async function PublicidadePage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "publicidade")) redirect("/painel");

  const supabase = await createClient();
  const { data: ads } = await supabase
    .from("ads").select("*").order("created_at", { ascending: false }) as { data: Ad[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader titulo="Publicidade" descricao="Banners e campanhas publicitárias do portal." />
      <PublicidadeClient ads={ads ?? []} />
    </div>
  );
}
