import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { NOTICIAS_FILTROS } from "@/lib/noticias-filtros";
import { absoluteUrl } from "@/lib/seo";

export const revalidate = 3600;

// Protocolo Sitemap: máx. 50.000 URLs por arquivo. Acima disso é preciso
// dividir em vários sitemaps (generateSitemaps) + índice.
const LIMITE_URLS = 49000;
const PAGINA = 1000;

type Linha = { slug: string; data: string | null };

/** Lê uma tabela em páginas. Se o Supabase falhar, devolve o que já tinha — nunca quebra o XML. */
async function buscarSlugs(
  tabela: "posts" | "articles" | "columnists" | "events",
  colunaData: string | null,
  filtros: (q: any) => any,
  max: number
): Promise<Linha[]> {
  const supabase = createPublicClient();
  const out: Linha[] = [];
  try {
    for (let from = 0; from < max; from += PAGINA) {
      const colunas = colunaData ? `slug, ${colunaData}` : "slug";
      let q = supabase.from(tabela).select(colunas);
      q = filtros(q).order("id", { ascending: false }).range(from, from + PAGINA - 1);
      const { data, error } = await q;
      if (error || !data) break;
      for (const r of data as unknown as Record<string, string | null>[]) {
        if (r.slug) out.push({ slug: r.slug, data: colunaData ? r[colunaData] ?? null : null });
      }
      if (data.length < PAGINA) break;
    }
  } catch {
    // mantém o parcial
  }
  return out;
}

const data = (iso: string | null) => (iso ? new Date(iso) : undefined);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const estaticas: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "hourly", priority: 1 },
    { url: absoluteUrl("/noticias"), changeFrequency: "hourly", priority: 0.9 },
    ...Object.keys(NOTICIAS_FILTROS).map((s) => ({
      url: absoluteUrl(`/noticias/${s}`),
      changeFrequency: "hourly" as const,
      priority: 0.7,
    })),
    { url: absoluteUrl("/colunistas"), changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/eventos"), changeFrequency: "daily", priority: 0.6 },
    { url: absoluteUrl("/vagas"), changeFrequency: "daily", priority: 0.5 },
    { url: absoluteUrl("/guia"), changeFrequency: "weekly", priority: 0.5 },
    { url: absoluteUrl("/assinatura"), changeFrequency: "monthly", priority: 0.4 },
  ];

  const [posts, artigos, colunistas, eventos] = await Promise.all([
    buscarSlugs("posts", "published_at", (q) => q.not("published_at", "is", null), LIMITE_URLS - 200),
    buscarSlugs("articles", "published_at", (q) => q.not("published_at", "is", null), 2000),
    buscarSlugs("columnists", null, (q) => q.eq("ativo", true), 500),
    buscarSlugs("events", "date_start", (q) => q, 2000),
  ]);

  // posts não tem updated_at no schema; published_at é a única data real disponível.
  const dinamicas: MetadataRoute.Sitemap = [
    ...posts.map((p) => ({ url: absoluteUrl(`/noticias/${p.slug}`), lastModified: data(p.data), changeFrequency: "weekly" as const, priority: 0.8 })),
    ...artigos.map((a) => ({ url: absoluteUrl(`/artigos/${a.slug}`), lastModified: data(a.data), changeFrequency: "monthly" as const, priority: 0.6 })),
    ...colunistas.map((c) => ({ url: absoluteUrl(`/colunistas/${c.slug}`), changeFrequency: "weekly" as const, priority: 0.5 })),
    ...eventos.map((e) => ({ url: absoluteUrl(`/eventos/${e.slug}`), changeFrequency: "weekly" as const, priority: 0.5 })),
  ];

  const vistos = new Set<string>();
  return [...estaticas, ...dinamicas]
    .filter((e) => (vistos.has(e.url) ? false : (vistos.add(e.url), true)))
    .slice(0, 50000);
}
