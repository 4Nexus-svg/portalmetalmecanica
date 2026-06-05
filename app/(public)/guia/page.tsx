import { createClient } from "@/lib/supabase/server";
import GuiaPublicoClient from "./GuiaPublicoClient";
import type { Database } from "@/types/database";

type Empresa = Database["public"]["Tables"]["companies"]["Row"];

export const revalidate = 300;

export default async function GuiaPublicoPage() {
  const supabase = await createClient();
  const { data: empresas } = await supabase
    .from("companies").select("*").eq("ativo", true).order("name", { ascending: true }) as { data: Empresa[] | null; error: unknown };

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-[#1A2B4A] mb-1">Guia Industrial</h1>
      <p className="text-sm text-gray-500 mb-6">Empresas e fornecedores do setor metalmecânico.</p>
      <GuiaPublicoClient empresas={empresas ?? []} />
    </main>
  );
}
