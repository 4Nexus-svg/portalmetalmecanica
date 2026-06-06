import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import HomeBuilderClient from "./HomeBuilderClient";
import type { Database } from "@/types/database";

type Bloco = Database["public"]["Tables"]["home_blocks"]["Row"];

export default async function HomeBuilderPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "home")) redirect("/painel");

  const supabase = await createClient();
  const { data: blocos } = await supabase
    .from("home_blocks").select("*").order("ordem", { ascending: true }) as { data: Bloco[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader titulo="Home" descricao="Arraste para reordenar e ative/desative os blocos da home." />
      <HomeBuilderClient inicial={blocos ?? []} />
    </div>
  );
}
