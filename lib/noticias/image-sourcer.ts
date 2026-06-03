import type { FeedItem } from './types';
import { safeRun } from './utils';

const UA = 'Mozilla/5.0 (compatible; PortalMetalmecanica/1.0)';

function isImagemValida(url: string): boolean {
  if (!url || !url.startsWith('http')) return false;
  const lower = url.toLowerCase();
  if (lower.endsWith('.svg') || lower.endsWith('.gif')) return false;
  if (lower.includes('favicon') || lower.includes('/icon') || lower.includes('logo')) return false;
  return true;
}

async function extrairOgImage(url: string): Promise<string | null> {
  return safeRun(
    async () => {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const html = await res.text();

      // og:image
      const ogMatch =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (ogMatch && isImagemValida(ogMatch[1])) return ogMatch[1];

      // twitter:image
      const twMatch =
        html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
      if (twMatch && isImagemValida(twMatch[1])) return twMatch[1];

      // Primeira <img> dentro de <article> ou <main>
      const bodyMatch = html.match(/<(?:article|main)[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
      if (bodyMatch && isImagemValida(bodyMatch[1])) return bodyMatch[1];

      return null;
    },
    { fallback: null }
  );
}

export async function resolverImagem(item: FeedItem): Promise<string | null> {
  // 1. Imagem já retornada pela API/RSS
  if (item.imagemUrl && isImagemValida(item.imagemUrl)) {
    return item.imagemUrl;
  }

  // 2. Scraping og:image do artigo original
  const scraped = await extrairOgImage(item.url);
  if (scraped) return scraped;

  // 3. Sem imagem — publisher usa placeholder
  return null;
}
