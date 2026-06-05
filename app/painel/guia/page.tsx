import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import GuiaClient from "./GuiaClient";
import type { Database } from "@/types/database";

type Empresa = Database["public"]["Tables"]["companies"]["Row"];

export default async function GuiaPainelPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "guia")) redirect("/painel");

  const supabase = await createClient();
  const { data: itens } = await supabase
    .from("companies").select("*").order("name", { ascending: true }) as { data: Empresa[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader titulo="Guia Industrial" descricao="Guia industrial de empresas e fornecedores." />
      <GuiaClient itens={itens ?? []} />
    </div>
  );
}
