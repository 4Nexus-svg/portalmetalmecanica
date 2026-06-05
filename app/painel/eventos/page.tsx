import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import EventosClient from "./EventosClient";
import type { Database } from "@/types/database";

type Evento = Database["public"]["Tables"]["events"]["Row"];

export default async function EventosPainelPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "eventos")) redirect("/painel");

  const supabase = await createClient();
  const { data: itens } = await supabase
    .from("events").select("*").order("date_start", { ascending: false }) as { data: Evento[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader titulo="Eventos" descricao="Feiras, congressos e eventos do setor." />
      <EventosClient itens={itens ?? []} />
    </div>
  );
}
