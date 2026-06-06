import Link from "next/link";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["posts"]["Row"];

export default function MaisNoticias({ posts }: { posts: Post[] }) {
  if (posts.length === 0) return null;
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-6 bg-[#C9A84C] rounded" />
        <h2 className="text-lg font-bold text-[#1A2B4A] uppercase tracking-wide">Mais Notícias</h2>
      </div>
      <div className="space-y-3">
        {posts.map((post, i) => (
          <Link key={post.id} href={"/noticias/" + post.slug} className="group flex gap-4 bg-white rounded-lg border border-gray-100 p-3 hover:shadow-md transition-shadow">
            <span className="text-2xl font-black text-gray-100 w-8 flex-shrink-0 leading-none mt-1">{String(i + 1).padStart(2, "0")}</span>
            <div className="flex-1">
              {post.category && <span className="text-xs font-bold text-[#C9A84C] uppercase">{post.category}</span>}
              <h3 className="font-semibold text-gray-900 group-hover:text-[#1A2B4A] transition-colors line-clamp-2 text-sm mt-0.5">{post.title}</h3>
            </div>
            {post.featured_image && (
              <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden">
                <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover" />
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
