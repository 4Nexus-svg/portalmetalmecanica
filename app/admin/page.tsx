import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");

  const { data: posts } = await supabase
    .from("posts")
    .select("id, slug, title, category, region, published_at, is_exclusive")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Painel Admin</h1>
          <p className="text-sm text-gray-500 mt-1">Olá, {profile?.name ?? user.email}</p>
        </div>
        <Link
          href="/admin/posts/novo"
          className="bg-orange-500 text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-orange-600 transition-colors"
        >
          + Nova notícia
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total de posts", value: posts?.length ?? 0 },
          { label: "Publicados", value: posts?.filter(p => p.published_at).length ?? 0 },
          { label: "Exclusivos", value: posts?.filter(p => p.is_exclusive).length ?? 0 },
          { label: "Rascunhos", value: posts?.filter(p => !p.published_at).length ?? 0 },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-blue-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Lista de posts */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Notícias</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="text-left px-6 py-3">Título</th>
              <th className="text-left px-6 py-3 hidden md:table-cell">Categoria</th>
              <th className="text-left px-6 py-3 hidden md:table-cell">Região</th>
              <th className="text-left px-6 py-3 hidden md:table-cell">Publicado em</th>
              <th className="text-left px-6 py-3">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(posts ?? []).map((post) => (
              <tr key={post.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900 max-w-xs truncate">
                  {post.title}
                </td>
                <td className="px-6 py-4 text-gray-500 hidden md:table-cell">
                  {post.category ?? "—"}
                </td>
                <td className="px-6 py-4 text-gray-500 hidden md:table-cell">
                  {post.region ?? "—"}
                </td>
                <td className="px-6 py-4 text-gray-500 hidden md:table-cell">
                  {post.published_at
                    ? format(new Date(post.published_at), "dd/MM/yyyy", { locale: ptBR })
                    : "—"}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {post.published_at ? (
                      <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                        Publicado
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                        Rascunho
                      </span>
                    )}
                    {post.is_exclusive && (
                      <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                        Exclusivo
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={"/admin/posts/" + post.id}
                    className="text-blue-700 hover:text-blue-900 font-medium text-xs"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(!posts || posts.length === 0) && (
          <div className="px-6 py-12 text-center text-gray-400">
            Nenhuma notícia cadastrada ainda.
          </div>
        )}
      </div>
    </main>
  );
}