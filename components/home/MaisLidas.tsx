import Link from "next/link";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["posts"]["Row"];

export default function MaisLidas({ posts }: { posts: Post[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="bg-[#1A2B4A] px-4 py-3 flex items-center gap-2">
        <div className="w-1 h-5 bg-[#C9A84C] rounded" />
        <h3 className="text-white font-bold text-sm uppercase tracking-wide">Mais Lidas</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {posts.map((post, i) => (
          <Link key={post.id} href={"/noticias/" + post.slug} className="group flex gap-3 p-3 hover:bg-gray-50 transition-colors">
            <span className="text-2xl font-black text-gray-100 w-6 flex-shrink-0 leading-none">{i + 1}</span>
            <div>
              {post.category && <span className="text-xs font-bold text-[#C9A84C] uppercase">{post.category}</span>}
              <h4 className="text-sm font-medium text-gray-800 group-hover:text-[#1A2B4A] line-clamp-2 leading-tight mt-0.5">{post.title}</h4>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
