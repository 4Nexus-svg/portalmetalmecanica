import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import ClassificadosClient from "./ClassificadosClient";
import type { Database } from "@/types/database";

type Classificado = Database["public"]["Tables"]["classifieds"]["Row"];

export default async function ClassificadosPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "classificados")) redirect("/painel");

  const supabase = await createClient();
  const { data: itens } = await supabase
    .from("classifieds").select("*").order("created_at", { ascending: false }) as { data: Classificado[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader titulo="Classificados" descricao="Anúncios classificados de máquinas, equipamentos e serviços." />
      <ClassificadosClient itens={itens ?? []} />
    </div>
  );
}
