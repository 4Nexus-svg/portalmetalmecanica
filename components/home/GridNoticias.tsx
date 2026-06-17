import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["posts"]["Row"];

export default function GridNoticias({ posts }: { posts: Post[] }) {
  if (posts.length === 0) return null;
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-6 bg-[#C9A84C] rounded" />
        <h2 className="text-lg font-bold text-[#1A2B4A] uppercase tracking-wide">Últimas Notícias</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {posts.map((post) => (
          <Link key={post.id} href={"/noticias/" + post.slug} className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
            <div className="aspect-video bg-gray-100 overflow-hidden">
              {post.featured_image ? (
                <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-full bg-[#1A2B4A]/10 flex items-center justify-center font-bold text-gray-300 text-2xl">PM</div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-1">
                {post.category && <span className="text-xs font-bold text-[#C9A84C] uppercase">{post.category}</span>}
                {post.region && <span className="text-xs text-gray-400">· {post.region}</span>}
                {post.is_exclusive && <span className="text-xs bg-[#1A2B4A] text-white px-1.5 py-0.5 rounded font-bold">EXCLUSIVO</span>}
              </div>
              <h3 className="font-semibold text-gray-900 group-hover:text-[#1A2B4A] line-clamp-2 leading-tight">{post.title}</h3>
              {post.excerpt && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{post.excerpt}</p>}
              <div className="flex items-center justify-between mt-2">
                {post.fonte_nome && <p className="text-xs text-gray-400 font-medium">{post.fonte_nome}</p>}
                {post.published_at && (
                  <p className="text-xs text-gray-400">{format(new Date(post.published_at), "d 'de' MMMM", { locale: ptBR })}</p>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
