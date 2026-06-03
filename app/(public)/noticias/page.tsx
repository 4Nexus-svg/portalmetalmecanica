import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["posts"]["Row"];

export const revalidate = 60;

export const metadata = {
  title: "Notícias | Portal Metalmecânica",
  description: "As últimas notícias do setor metalmecânico, siderurgia, automação e indústria pesada do ES e MG.",
};

const FILTROS = [
  { label: "Todas",         href: "/noticias" },
  { label: "Espírito Santo",href: "/noticias/es" },
  { label: "Minas Gerais",  href: "/noticias/mg" },
  { label: "Brasil",        href: "/noticias/brasil" },
  { label: "Economia",      href: "/noticias/economia" },
  { label: "Tecnologia",    href: "/noticias/tecnologia" },
  { label: "Sustentabilidade", href: "/noticias/sustentabilidade" },
  { label: "Segurança",     href: "/noticias/seguranca" },
];

export default async function NoticiasPage() {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("posts")
    .select("*")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(48) as { data: Post[] | null; error: unknown };

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <div className="border-l-4 border-[#C9A84C] pl-4 mb-8">
        <h1 className="text-3xl font-bold text-[#1A2B4A]">Notícias</h1>
        <p className="text-gray-500 mt-1">As últimas do setor metalmecânico</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap mb-8">
        {FILTROS.map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors
              ${f.href === "/noticias"
                ? "bg-[#1A2B4A] text-white border-[#1A2B4A]"
                : "border-gray-200 text-gray-600 hover:border-[#1A2B4A] hover:text-[#1A2B4A]"}`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {!posts?.length ? (
        <p className="text-gray-400 text-center py-20">Nenhuma notícia publicada ainda.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/noticias/${post.slug}`}
              className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden group hover:shadow-md transition-shadow"
            >
              <div className="aspect-video bg-gray-100 overflow-hidden">
                {post.featured_image ? (
                  <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-3xl font-bold text-gray-200">PM</span>
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex gap-2 mb-2">
                  {post.category && (
                    <span className="text-xs font-semibold text-orange-500 uppercase tracking-wide">{post.category}</span>
                  )}
                  {post.region && (
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{post.region}</span>
                  )}
                </div>
                <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-[#1A2B4A] transition-colors">{post.title}</h3>
                {post.excerpt && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{post.excerpt}</p>}
                {post.published_at && (
                  <p className="text-xs text-gray-400 mt-3">
                    {format(new Date(post.published_at), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
