import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import type { FeedItem } from './types';
import { safeRun } from './utils';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const EXTENSAO_POR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
};

// Muitas fontes (ex.: gov.br) bloqueiam hotlink com WAF/anti-bot após um tempo,
// devolvendo HTML 401/403 no lugar da imagem (ORB no browser). Por isso a imagem
// é baixada aqui (server-side, sem esse bloqueio) e re-hospedada no Storage.
// Também recomprime pra WebP (largura máx. 1200px) — reduz uso do Storage
// (Free plan só tem 1GB) já que o pipeline agora hospeda toda imagem de notícia.
async function baixarEHospedar(url: string): Promise<string | null> {
  return safeRun(
    async () => {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'image/*' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return null;

      const contentType = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
      if (!EXTENSAO_POR_MIME[contentType]) return null;

      const original = Buffer.from(await res.arrayBuffer());
      if (original.byteLength === 0) return null;

      const comprimida = await sharp(original)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 75 })
        .toBuffer();

      const path = `noticias/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
      const supabase = getServiceClient();
      const { error } = await supabase.storage
        .from('painel')
        .upload(path, comprimida, { contentType: 'image/webp' });
      if (error) return null;

      return supabase.storage.from('painel').getPublicUrl(path).data.publicUrl;
    },
    { fallback: null }
  );
}

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
  let candidata: string | null =
    item.imagemUrl && isImagemValida(item.imagemUrl) ? item.imagemUrl : null;

  // 2. Scraping og:image do artigo original
  if (!candidata) {
    candidata = await extrairOgImage(item.url);
  }

  if (!candidata) return null;

  // 3. Baixa e re-hospeda no Storage — link hotlinkado quebra com o tempo
  //    (WAF/anti-bot de terceiros). Se falhar, não usa a URL original: ela
  //    tende a acabar quebrada mesmo funcionando no momento da publicação.
  return baixarEHospedar(candidata);
}
