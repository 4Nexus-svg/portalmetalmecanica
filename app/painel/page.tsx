import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPainelUser } from "@/lib/painel/auth";
import { secoesDisponiveis, SECOES_META } from "@/lib/painel/permissions";
import DashboardCharts, { type SeriePonto } from "./DashboardCharts";

export default async function PainelDashboard() {
  const u = await getPainelUser();
  if (!u) redirect("/login?next=/painel");

  const supabase = await createClient();
  const agora = new Date().toISOString();

  async function conta(tabela: string, filtro?: (q: any) => any): Promise<number> {
    let q = (supabase.from(tabela) as any).select("*", { count: "exact", head: true });
    if (filtro) q = filtro(q);
    const { count } = await q;
    return count ?? 0;
  }

  const [assinantes, postsPub, classifPend, empresas, vagasAtivas, artigosPub] = await Promise.all([
    conta("subscriptions", (q: any) => q.eq("status", "active").gte("current_period_end", agora)),
    conta("posts", (q: any) => q.not("published_at", "is", null)),
    conta("classifieds", (q: any) => q.eq("status", "pending")),
    conta("companies", (q: any) => q.eq("ativo", true)),
    conta("jobs", (q: any) => q.eq("ativo", true)),
    conta("articles", (q: any) => q.not("published_at", "is", null)),
  ]);

  const cards = [
    { label: "Assinantes ativos", value: assinantes },
    { label: "Posts publicados", value: postsPub },
    { label: "Classificados pendentes", value: classifPend },
    { label: "Empresas no guia", value: empresas },
    { label: "Vagas ativas", value: vagasAtivas },
    { label: "Artigos publicados", value: artigosPub },
  ];

  // série: novos assinantes nos últimos 6 meses
  const { data: subs } = await supabase.from("subscriptions").select("created_at") as
    { data: { created_at: string }[] | null; error: unknown };
  const meses: SeriePonto[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "short" });
    const valor = (subs ?? []).filter((s) => (s.created_at ?? "").startsWith(chave)).length;
    meses.push({ label, valor });
  }

  // série: posts por categoria (top 6)
  const { data: postsCat } = await supabase.from("posts").select("category").not("category", "is", null) as
    { data: { category: string | null }[] | null; error: unknown };
  const contagem: Record<string, number> = {};
  for (const p of postsCat ?? []) {
    const c = p.category ?? "—";
    contagem[c] = (contagem[c] ?? 0) + 1;
  }
  const postsPorCategoria: SeriePonto[] = Object.entries(contagem)
    .sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, valor]) => ({ label, valor }));

  const atalhos = secoesDisponiveis(u.role).filter((s) => s !== "dashboard");

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A2B4A] mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className="text-2xl font-bold text-[#1A2B4A]">{c.value}</p>
          </div>
        ))}
      </div>

      <DashboardCharts assinantesPorMes={meses} postsPorCategoria={postsPorCategoria} />

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Atalhos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {atalhos.map((secao) => {
          const meta = SECOES_META[secao];
          const Icone = meta.icone;
          return (
            <Link key={secao} href={meta.rota} className="group bg-white rounded-xl border border-gray-100 p-5 hover:border-[#C9A84C] hover:shadow-sm transition-all">
              <div className="w-10 h-10 rounded-lg bg-[#1A2B4A]/5 flex items-center justify-center mb-3 group-hover:bg-[#C9A84C]/15 transition-colors">
                <Icone className="w-5 h-5 text-[#1A2B4A]" />
              </div>
              <p className="font-semibold text-[#1A2B4A]">{meta.label}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
