import Link from "next/link";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["posts"]["Row"];

interface Secao {
  titulo: string;
  posts: Post[];
}

export default function SecoesCategorias({ secoes }: { secoes: Secao[] }) {
  return (
    <div className="space-y-10">
      {secoes.map((secao) => {
        if (secao.posts.length === 0) return null;
        return (
          <section key={secao.titulo}>
            <div className="bg-[#C9A84C] px-4 py-3 mb-4 rounded-sm">
              <h2 className="text-white font-black italic uppercase tracking-tight text-2xl md:text-3xl leading-none">
                {secao.titulo}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {secao.posts.slice(0, 4).map((post) => (
                <Link
                  key={post.id}
                  href={`/noticias/${post.slug}`}
                  className="group flex flex-col bg-white rounded-lg border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                >
                  {post.featured_image && (
                    <div className="aspect-video overflow-hidden flex-shrink-0">
                      <img
                        src={post.featured_image}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="p-3 flex-1">
                    {post.category && (
                      <span className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-wide">
                        {post.category}
                      </span>
                    )}
                    <h3 className="font-bold text-gray-900 group-hover:text-[#1A2B4A] transition-colors line-clamp-3 text-sm mt-1 leading-snug">
                      {post.title}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
