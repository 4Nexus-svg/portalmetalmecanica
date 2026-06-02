import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search } from "lucide-react";

interface Post {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  featured_image: string | null;
  category: string | null;
  region: string | null;
  published_at: string | null;
}

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function BuscaPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const supabase = await createClient();

  const posts: Post[] = [];

  if (q && q.trim().length > 1) {
   const { data } = await supabase
  .from("posts")
  .select("id, slug, title, excerpt, featured_image, category, region, published_at")
  .not("published_at", "is", null)
  .textSearch("search_vector", q.trim(), { type: "websearch", config: "portuguese" })
  .order("published_at", { ascending: false })
  .limit(20) as { data: Post[] | null };

if (data) posts.push(...data);
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Search size={20} className="text-[#C9A84C]" />
        <h1 className="text-xl font-bold text-[#1A2B4A]">
          {q ? `Resultados para "${q}"` : "Busca"}
        </h1>
        {q && (
          <span className="text-sm text-gray-400">— {posts.length} resultado{posts.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      {!q && (
        <p className="text-gray-500">Digite um termo para buscar notícias no portal.</p>
      )}

      {q && posts.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Search size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Nenhum resultado encontrado</p>
          <p className="text-sm mt-1">Tente outros termos de busca</p>
        </div>
      )}

      <div className="space-y-4">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={"/noticias/" + post.slug}
            className="group flex gap-4 bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
          >
            {post.featured_image && (
              <div className="w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden">
                <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {post.category && <span className="text-xs font-bold text-[#C9A84C] uppercase">{post.category}</span>}
                {post.region && <span className="text-xs text-gray-400">· {post.region}</span>}
              </div>
              <h2 className="font-semibold text-gray-900 group-hover:text-[#1A2B4A] transition-colors line-clamp-2">
                {post.title}
              </h2>
              {post.excerpt && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{post.excerpt}</p>
              )}
              {post.published_at && (
                <p className="text-xs text-gray-400 mt-2">
                  {format(new Date(post.published_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}