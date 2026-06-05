import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Database } from "@/types/database";

type Colunista = Database["public"]["Tables"]["columnists"]["Row"];
type Artigo = Database["public"]["Tables"]["articles"]["Row"];

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 300;

export default async function ColunistaPerfilPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: colunista } = await supabase
    .from("columnists").select("*").eq("slug", slug).maybeSingle() as { data: Colunista | null; error: unknown };

  if (!colunista) notFound();

  const { data: artigos } = await supabase
    .from("articles").select("*").eq("columnist_id", colunista.id).not("published_at", "is", null)
    .order("published_at", { ascending: false }) as { data: Artigo[] | null; error: unknown };

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        {colunista.foto_url
          ? <img src={colunista.foto_url} alt={colunista.nome} className="w-20 h-20 rounded-full object-cover" />
          : <div className="w-20 h-20 rounded-full bg-[#1A2B4A] text-white flex items-center justify-center font-bold text-xl">{colunista.iniciais ?? colunista.nome[0]}</div>}
        <div>
          <h1 className="text-2xl font-bold text-[#1A2B4A]">{colunista.nome}</h1>
          {colunista.especialidade && <p className="text-sm text-[#C9A84C] font-semibold">{colunista.especialidade}</p>}
          {colunista.bio && <p className="text-sm text-gray-500 mt-1">{colunista.bio}</p>}
        </div>
      </div>

      <h2 className="text-lg font-bold text-[#1A2B4A] mb-4">Artigos</h2>
      {(!artigos || artigos.length === 0) ? (
        <p className="text-gray-400">Nenhum artigo publicado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {artigos.map((a) => (
            <Link key={a.id} href={"/artigos/" + a.slug} className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              {a.cover_url && <img src={a.cover_url} alt={a.title} className="w-full aspect-video object-cover" />}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 group-hover:text-[#1A2B4A] line-clamp-2">{a.title}</h3>
                {a.excerpt && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.excerpt}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
