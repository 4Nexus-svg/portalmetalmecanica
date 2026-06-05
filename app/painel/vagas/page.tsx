import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import VagasClient from "./VagasClient";
import type { Database } from "@/types/database";

type Vaga = Database["public"]["Tables"]["jobs"]["Row"];

export default async function VagasPainelPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "vagas")) redirect("/painel");

  const supabase = await createClient();
  const { data: itens } = await supabase
    .from("jobs").select("*").order("created_at", { ascending: false }) as { data: Vaga[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader titulo="Vagas" descricao="Vagas de emprego do setor metalmecânico." />
      <VagasClient itens={itens ?? []} />
    </div>
  );
}
