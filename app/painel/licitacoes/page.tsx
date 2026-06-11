import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import LicitacoesClient from "./LicitacoesClient";
import type { Database } from "@/types/database";

type Licitacao = Database["public"]["Tables"]["licitacoes_pncp"]["Row"];

export default async function LicitacoesPainelPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "licitacoes")) redirect("/painel");

  const supabase = await createClient();
  const { data: itens } = await supabase
    .from("licitacoes_pncp")
    .select("*")
    .order("data_encerramento", { ascending: true, nullsFirst: false }) as { data: Licitacao[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader
        titulo="Licitações"
        descricao="Licitações públicas do setor metalmecânico. Cadastre manualmente oportunidades encontradas no PNCP."
      />
      <LicitacoesClient itens={itens ?? []} />
    </div>
  );
}
