import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import Manchete from "@/components/home/Manchete";
import FaixaColunistas from "@/components/home/FaixaColunistas";
import { EmpresasDestaque } from "@/components/ui/EmpresasDestaque";
import GridNoticias from "@/components/home/GridNoticias";
import BannerBetween from "@/components/home/BannerBetween";
import MaisNoticias from "@/components/home/MaisNoticias";
import BannerSidebar from "@/components/home/BannerSidebar";
import MaisLidas from "@/components/home/MaisLidas";
import Newsletter from "@/components/home/Newsletter";
import Assinar from "@/components/home/Assinar";
import CanaisRegionais from "@/components/home/CanaisRegionais";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["posts"]["Row"];
type Bloco = Database["public"]["Tables"]["home_blocks"]["Row"];

export const revalidate = 300;

const ORDEM_PADRAO: Pick<Bloco, "key" | "coluna" | "ordem" | "ativo">[] = [
  { key: "manchete", coluna: "full", ordem: 0, ativo: true },
  { key: "faixa_colunistas", coluna: "full", ordem: 1, ativo: true },
  { key: "empresas_destaque", coluna: "full", ordem: 2, ativo: true },
  { key: "grid_noticias", coluna: "main", ordem: 0, ativo: true },
  { key: "banner_between", coluna: "main", ordem: 1, ativo: true },
  { key: "mais_noticias", coluna: "main", ordem: 2, ativo: true },
  { key: "banner_sidebar", coluna: "sidebar", ordem: 0, ativo: true },
  { key: "mais_lidas", coluna: "sidebar", ordem: 1, ativo: true },
  { key: "newsletter", coluna: "sidebar", ordem: 2, ativo: true },
  { key: "assinar", coluna: "sidebar", ordem: 3, ativo: true },
  { key: "canais_regionais", coluna: "sidebar", ordem: 4, ativo: true },
];

export default async function HomePage() {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("posts").select("*").not("published_at", "is", null).neq("category", "Legislacao")
    .order("published_at", { ascending: false }).limit(20) as { data: Post[] | null; error: unknown };

  const { data: blocosDb } = await supabase
    .from("home_blocks").select("*").eq("ativo", true).order("ordem", { ascending: true }) as { data: Bloco[] | null; error: unknown };

  const settings = await getSettings();

  const lista = (blocosDb && blocosDb.length > 0 ? blocosDb : ORDEM_PADRAO) as Pick<Bloco, "key" | "coluna" | "ordem" | "ativo">[];
  const ativos = lista.filter((b) => b.ativo);

  const destaque = posts?.[0];
  const secundarias = posts?.slice(1, 4) ?? [];
  const grid = posts?.slice(4, 10) ?? [];
  const maisLidas = posts?.slice(0, 6) ?? [];
  const ultimasNoticias = posts?.slice(10, 16) ?? [];

  const COMPONENTES: Record<string, React.ReactNode> = {
    manchete: <Manchete destaque={destaque} secundarias={secundarias} />,
    faixa_colunistas: <FaixaColunistas />,
    empresas_destaque: <EmpresasDestaque />,
    grid_noticias: <GridNoticias posts={grid} />,
    banner_between: <BannerBetween />,
    mais_noticias: <MaisNoticias posts={ultimasNoticias} />,
    banner_sidebar: <BannerSidebar />,
    mais_lidas: <MaisLidas posts={maisLidas} />,
    newsletter: <Newsletter />,
    assinar: <Assinar preco={settings.subscription_price || "290"} />,
    canais_regionais: <CanaisRegionais />,
  };

  const porColuna = (col: "full" | "main" | "sidebar") =>
    ativos.filter((b) => b.coluna === col).sort((a, b) => a.ordem - b.ordem);

  const full = porColuna("full");
  const main = porColuna("main");
  const sidebar = porColuna("sidebar");

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 pt-6">
        {full.map((b) => <div key={b.key}>{COMPONENTES[b.key]}</div>)}
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-2 space-y-8">
            {main.map((b) => <div key={b.key}>{COMPONENTES[b.key]}</div>)}
          </div>
          <aside className="space-y-6">
            {sidebar.map((b) => <div key={b.key}>{COMPONENTES[b.key]}</div>)}
          </aside>
        </div>
      </div>
    </>
  );
}
