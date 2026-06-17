import Link from "next/link";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["posts"]["Row"];

interface Secao {
  titulo: string;
  href: string;
  posts: Post[];
}

export default function SecoesCategorias({ secoes }: { secoes: Secao[] }) {
  return (
    <div className="space-y-10">
      {secoes.map((secao) => {
        if (secao.posts.length === 0) return null;
        return (
          <section key={secao.titulo}>
            <div className="flex items-center justify-between bg-[#C9A84C] px-4 py-3 mb-4 rounded-sm">
              <h2 className="text-white font-black italic uppercase tracking-tight text-2xl md:text-3xl leading-none">
                {secao.titulo}
              </h2>
              <Link
                href={secao.href}
                className="text-white text-xs font-bold uppercase tracking-widest border border-white/60 px-3 py-1.5 rounded hover:bg-white hover:text-[#C9A84C] transition-colors whitespace-nowrap"
              >
                Ver Todas
              </Link>
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
                  <div className="p-3 flex-1 flex flex-col">
                    {post.category && (
                      <span className="text-[11px] font-bold text-[#C9A84C] uppercase tracking-wide">
                        {post.category}
                      </span>
                    )}
                    <h3 className="font-bold text-gray-900 group-hover:text-[#1A2B4A] transition-colors line-clamp-3 text-sm mt-1 leading-snug flex-1">
                      {post.title}
                    </h3>
                    {post.fonte_nome && (
                      <p className="text-[11px] text-gray-400 mt-2 font-medium">{post.fonte_nome}</p>
                    )}
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
