import { createClient } from '@supabase/supabase-js';
import type { FeedItem, ItemComScore } from './types';
import { slugifyTitulo, normT } from './utils';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type Existentes = {
  urls: Set<string>;
  titulos: Set<string>;
};

export async function buscarExistentes(): Promise<Existentes> {
  const supabase = getServiceClient();
  const setesDias = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const { data } = await supabase
    .from('posts')
    .select('fonte_url, title')
    .gte('created_at', setesDias);

  const urls = new Set<string>();
  const titulos = new Set<string>();

  for (const row of (data as { fonte_url: string | null; title: string }[]) ?? []) {
    if (row.fonte_url) urls.add(urlChave(row.fonte_url));
    if (row.title) titulos.add(normT(row.title));
  }

  return { urls, titulos };
}

// Chave canônica da URL: remove query/hash e, quando o path termina em ID numérico
// (ex.: Tribuna Online republica o mesmo ID com slug/título diferente), usa host+ID.
export function urlChave(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const id = u.pathname.match(/-(\d{5,})\/?$/)?.[1];
    if (id) return `${host}#${id}`;
    return `${host}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return url;
  }
}

function tokens(t: string): Set<string> {
  return new Set(t.split(' ').filter((w) => w.length > 3));
}

function similar(a: string, b: string): boolean {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size < 4 || tb.size < 4) return false;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / (ta.size + tb.size - inter) >= 0.6;
}

export function ehDuplicata(
  item: FeedItem,
  existentes: Existentes,
  linksSeen: Set<string>,
  titulosSeen: Set<string>
): boolean {
  const chave = urlChave(item.url);
  if (existentes.urls.has(chave) || linksSeen.has(chave)) return true;
  const tNorm = normT(item.titulo);
  if (existentes.titulos.has(tNorm) || titulosSeen.has(tNorm)) return true;
  for (const t of existentes.titulos) if (similar(tNorm, t)) return true;
  for (const t of titulosSeen) if (similar(tNorm, t)) return true;
  return false;
}

export function agruparPorHistoria(items: ItemComScore[]): {
  processados: ItemComScore[];
  multiFonte: number;
} {
  const byTitulo = new Map<string, ItemComScore[]>();

  for (const item of items) {
    const key = normT(item.titulo);
    const grupo = byTitulo.get(key) ?? [];
    grupo.push(item);
    byTitulo.set(key, grupo);
  }

  const processados: ItemComScore[] = [];
  let multiFonte = 0;

  for (const grupo of byTitulo.values()) {
    const fontesUnicas = new Set(grupo.map((i) => i.fonteNome));

    if (fontesUnicas.size < 2) {
      // fonte única — mantém o de maior score
      processados.push(grupo.sort((a, b) => b.score - a.score)[0]);
    } else {
      // múltiplas fontes — cria item mesclado com o de maior score como principal
      const ordenado = grupo.sort((a, b) => b.score - a.score);
      const principal = ordenado[0];
      const merged: ItemComScore = {
        ...principal,
        fonteNome: ordenado.map((i) => i.fonteNome).join(', '),
        fontesAdicionais: ordenado.slice(1).map((i) => ({
          url: i.url,
          nome: i.fonteNome,
          titulo: i.titulo,
          conteudo: i.conteudo,
        })),
      };
      processados.push(merged);
      multiFonte++;
    }
  }

  return { processados, multiFonte };
}

export function marcarVisto(
  item: FeedItem,
  linksSeen: Set<string>,
  titulosSeen: Set<string>
): void {
  linksSeen.add(urlChave(item.url));
  titulosSeen.add(normT(item.titulo));
}

async function gerarSlugUnico(
  supabase: ReturnType<typeof getServiceClient>,
  base: string
): Promise<string> {
  let slug = base;
  let tentativa = 0;
  while (true) {
    const { data } = await supabase
      .from('posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!data) return slug;
    tentativa++;
    slug = `${base}-${tentativa}`;
  }
}

export type DadosPublicacao = FeedItem & {
  tituloFinal: string;
  resumoFinal: string;
  conteudoFinal: string;
  categoria: string;
  regiao: string;
  imagemFinal: string | null;
};

export async function publicarNoticia(dados: DadosPublicacao): Promise<void> {
  const supabase = getServiceClient();
  const slugBase = slugifyTitulo(dados.tituloFinal);
  const slug = await gerarSlugUnico(supabase, slugBase);

  const { error } = await supabase.from('posts').insert({
    slug,
    title: dados.tituloFinal,
    excerpt: dados.resumoFinal,
    content: dados.conteudoFinal,
    featured_image: dados.imagemFinal,
    category: dados.categoria,
    region: dados.regiao,
    author_id: null,
    published_at: new Date().toISOString(),
    is_exclusive: false,
    fonte_url: dados.url,
    fonte_nome: dados.fonteNome,
    is_auto: true,
  });

  if (error) throw new Error(`Supabase insert: ${error.message}`);
}
