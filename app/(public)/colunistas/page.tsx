import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const revalidate = 3600;

export const metadata = {
  title: "Colunistas | Portal Metalmecânica",
  description: "Especialistas que movem a indústria do ES e MG.",
};

export default async function ColunistasPage() {
  const supabase = await createClient();

  const { data: colunistas } = await supabase
    .from("columnists")
    .select("id, nome, slug, cargo, especialidade, bio, iniciais, cor")
    .eq("ativo", true)
    .order("id");

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <div className="border-l-4 border-[#C9A84C] pl-4 mb-10">
        <h1 className="text-3xl font-bold text-[#1A2B4A]">Colunistas</h1>
        <p className="text-gray-500 mt-1">Especialistas que movem a indústria do ES e MG</p>
      </div>

      {!colunistas?.length ? (
        <p className="text-gray-400 text-center py-20">Nenhum colunista cadastrado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {colunistas.map((col) => (
            <div key={col.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-14 h-14 rounded-full ${col.cor} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-white font-bold text-lg">{col.iniciais}</span>
                  </div>
                  <div>
                    <h2 className="font-bold text-[#1A2B4A] text-lg leading-tight">{col.nome}</h2>
                    <p className="text-xs text-[#C9A84C] font-semibold mt-0.5">{col.especialidade}</p>
                    <p className="text-xs text-gray-500">{col.cargo}</p>
                  </div>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed mb-4">{col.bio}</p>

                <Link
                  href={`/colunistas/${col.slug}`}
                  className="inline-block text-sm font-semibold text-[#1A2B4A] hover:text-[#C9A84C] transition-colors"
                >
                  Ver colunas →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
