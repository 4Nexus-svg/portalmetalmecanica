import { createClient } from "@/lib/supabase/server";
import ColunistasCarrossel from "@/components/ui/ColunistasCarrossel";

export default async function FaixaColunistas() {
  const supabase = await createClient();
  const { data: colunistas } = await supabase
    .from("columnists")
    .select("nome, slug, especialidade, iniciais, cor, foto_url")
    .eq("ativo", true)
    .order("id");

  if (!colunistas?.length) return null;

  return <ColunistasCarrossel colunistas={colunistas} />;
}
