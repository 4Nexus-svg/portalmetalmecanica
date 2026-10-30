import Link from "next/link";
import { BannerSlot } from "@/components/ui/BannerSlot";
import { NOTICIAS_FILTROS } from "@/lib/noticias-filtros";
import { createPublicClient } from "@/lib/supabase/public";
import { POST_CARD_COLUNAS } from "@/lib/posts-colunas";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["posts"]["Row"];

/** Cabeçalho de painel no mesmo padrão visual da home (faixa azul + detalhe dourado). */
function Painel({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="bg-[#1A2B4A] px-4 py-3 flex items-center gap-2">
        <div className="w-1 h-5 bg-[#C9A84C] rounded" />
        <h3 className="text-white font-bold text-sm uppercase tracking-wide">{titulo}</h3>
      </div>
      {children}
    </section>
  );
}

/**
 * Sidebar do artigo — Server Component. Busca as últimas notícias diretamente
 * no Supabase; nada disso é puxado para o client.
 */
export default async function ArticleSidebar({ currentSlug }: { currentSlug: string }) {
  const supabase = createPublicClient();

  const { data: posts } = await supabase
    .from("posts")
    .select(POST_CARD_COLUNAS)
    .not("published_at", "is", null)
    .neq("slug", currentSlug)
    .order("published_at", { ascending: false })
    .limit(6) as { data: Post[] | null; error: unknown };

  const editorias = Object.entries(NOTICIAS_FILTROS).map(([key, f]) => ({
    label: f.label,
    href: `/noticias/${key}`,
  }));

  return (
    <aside className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
      {/* Banner de publicidade (retorna null se não houver anúncio ativo) */}
      <BannerSlot position="sidebar" />

      {/* Últimas notícias */}
      <Painel titulo="Últimas Notícias">
        {posts?.length ? (
          <div className="divide-y divide-gray-50">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/noticias/${post.slug}`}
                className="group flex gap-3 p-3 hover:bg-gray-50 transition-colors"
              >
                <span className="text-2xl font-black text-gray-100 w-6 flex-shrink-0 leading-none">
                  ›
                </span>
                <div className="min-w-0">
                  {post.category && (
                    <span className="text-xs font-bold text-[#C9A84C] uppercase">{post.category}</span>
                  )}
                  <h4 className="text-sm font-medium text-gray-800 group-hover:text-[#1A2B4A] line-clamp-2 leading-tight mt-0.5">
                    {post.title}
                  </h4>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="p-4 text-sm text-gray-400">Nenhuma notícia publicada ainda.</p>
        )}
      </Painel>

      {/* Editorias */}
      <Painel titulo="Editorias">
        <div className="divide-y divide-gray-50">
          {editorias.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 hover:text-[#1A2B4A] transition-colors"
            >
              {e.label}
            </Link>
          ))}
        </div>
      </Painel>
    </aside>
  );
}
