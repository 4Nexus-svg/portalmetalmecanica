import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Database } from "@/types/database";

type Vaga = Database["public"]["Tables"]["jobs"]["Row"];

export const revalidate = 300;

export default async function VagasPage() {
  const supabase = await createClient();
  const hoje = new Date().toISOString().split("T")[0];
  const { data: vagas } = await supabase
    .from("jobs").select("*").eq("ativo", true)
    .or(`expires_at.is.null,expires_at.gte.${hoje}`)
    .order("created_at", { ascending: false }) as { data: Vaga[] | null; error: unknown };

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-[#1A2B4A] mb-1">Vagas</h1>
      <p className="text-sm text-gray-500 mb-6">Oportunidades no setor metalmecânico.</p>

      {(!vagas || vagas.length === 0) ? (
        <p className="text-gray-400">Nenhuma vaga aberta no momento.</p>
      ) : (
        <div className="space-y-3">
          {vagas.map((v) => (
            <Link key={v.id} href={"/vagas/" + v.id} className="group block bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <h2 className="font-semibold text-[#1A2B4A] group-hover:text-[#C9A84C]">{v.title}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {[v.company, v.city && `${v.city}/${v.state ?? ""}`, v.type].filter(Boolean).join(" · ")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
