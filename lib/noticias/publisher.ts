import { createClient } from '@supabase/supabase-js';
import type { FeedItem } from './types';
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
    if (row.fonte_url) urls.add(row.fonte_url);
    if (row.title) titulos.add(normT(row.title));
  }

  return { urls, titulos };
}

export function ehDuplicata(
  item: FeedItem,
  existentes: Existentes,
  linksSeen: Set<string>,
  titulosSeen: Set<string>
): boolean {
  if (existentes.urls.has(item.url) || linksSeen.has(item.url)) return true;
  const tNorm = normT(item.titulo);
  if (existentes.titulos.has(tNorm) || titulosSeen.has(tNorm)) return true;
  return false;
}

export function marcarVisto(
  item: FeedItem,
  linksSeen: Set<string>,
  titulosSeen: Set<string>
): void {
  linksSeen.add(item.url);
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
    content: `<p>${dados.resumoFinal}</p>`,
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
