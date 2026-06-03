import { createClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { Database } from "@/types/database";

type Profile      = Database["public"]["Tables"]["profiles"]["Row"];
type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
type Post         = Database["public"]["Tables"]["posts"]["Row"];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile }      = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle() as { data: Profile | null; error: unknown };
  const { data: subscription } = await supabase.from("subscriptions").select("*").eq("user_id", user.id).eq("status", "active").maybeSingle() as { data: Subscription | null; error: unknown };
  const { data: posts }        = await supabase.from("posts").select("*").eq("is_exclusive", true).not("published_at", "is", null).order("published_at", { ascending: false }).limit(10) as { data: Post[] | null; error: unknown };

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-brand mb-8">Ola, {profile?.name ?? user.email}</h1>

      <div className="card p-6 mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Plano atual</p>
          <p className="text-lg font-semibold text-brand">{subscription?.plan === "yearly" ? "Anual" : "Mensal"} - Ativo</p>
          {subscription?.current_period_end && (
            <p className="text-sm text-gray-500 mt-1">
              Renova em {format(new Date(subscription.current_period_end), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          )}
        </div>
        <span className="bg-green-100 text-green-700 text-sm font-semibold px-3 py-1 rounded-full">Ativo</span>
      </div>

      <h2 className="text-xl font-semibold text-gray-800 mb-4">Conteudos exclusivos</h2>
      <div className="space-y-3">
        {(posts ?? []).map((post) => (
          <Link key={post.id} href={"/noticias/" + post.slug} className="card p-4 flex items-center justify-between hover:shadow-md transition-shadow group">
            <div>
              <p className="font-medium text-gray-900 group-hover:text-brand transition-colors">{post.title}</p>
              {post.category && <p className="text-xs text-accent mt-0.5">{post.category}</p>}
            </div>
            {post.published_at && (
              <time className="text-xs text-gray-400 whitespace-nowrap ml-4">
                {format(new Date(post.published_at), "dd/MM/yyyy", { locale: ptBR })}
              </time>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}
