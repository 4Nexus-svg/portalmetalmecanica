import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["posts"]["Row"];

export default function Manchete({ destaque, secundarias }: { destaque?: Post; secundarias: Post[] }) {
  if (!destaque) return null;
  return (
    <section className="mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Link href={"/noticias/" + destaque.slug} className="lg:col-span-2 group relative rounded-xl overflow-hidden block">
          <div className="relative aspect-video bg-[#1A2B4A]">
            {destaque.featured_image ? (
              <img src={destaque.featured_image} alt={destaque.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-80 transition-opacity" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#1A2B4A] to-[#0f1e35]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6">
              {destaque.category && (
                <span className="bg-[#C9A84C] text-white text-xs font-bold px-2 py-1 rounded mb-3 inline-block uppercase tracking-wide">{destaque.category}</span>
              )}
              <h2 className="text-white text-2xl md:text-3xl font-bold leading-tight mb-2 group-hover:text-[#C9A84C] transition-colors">{destaque.title}</h2>
              {destaque.excerpt && <p className="text-gray-300 text-sm line-clamp-2">{destaque.excerpt}</p>}
              <div className="flex items-center gap-3 mt-2">
                {destaque.fonte_nome && <p className="text-gray-400 text-xs font-medium">{destaque.fonte_nome}</p>}
                {destaque.published_at && (
                  <p className="text-gray-400 text-xs">{format(new Date(destaque.published_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                )}
              </div>
            </div>
          </div>
        </Link>

        <div className="flex flex-col gap-3">
          {secundarias.map((post) => (
            <Link key={post.id} href={"/noticias/" + post.slug} className="group flex gap-3 bg-white rounded-lg border border-gray-100 p-3 hover:shadow-md transition-shadow">
              <div className="w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-gray-100">
                {post.featured_image ? (
                  <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#1A2B4A]/10 flex items-center justify-center text-xs text-gray-400 font-bold">PM</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {post.category && <span className="text-xs font-bold text-[#C9A84C] uppercase">{post.category}</span>}
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-[#1A2B4A] line-clamp-2 mt-0.5 leading-tight">{post.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  {post.fonte_nome && <p className="text-xs text-gray-400 font-medium">{post.fonte_nome}</p>}
                  {post.published_at && (
                    <p className="text-xs text-gray-400">{format(new Date(post.published_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-[#C9A84C] via-[#e8c97a] to-[#C9A84C] mt-8" />
    </section>
  );
}
