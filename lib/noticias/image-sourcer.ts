import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import https from 'https';
import type { FeedItem } from './types';
import { safeRun } from './utils';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
// Alguns sites (ex.: fiemg.com.br) devolvem 403 pra requests com só
// User-Agent — precisam de um conjunto de headers mais completo pra passar
// pelo WAF/anti-bot.
const HEADERS_NAVEGADOR = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Upload direto via https.request, sem passar pelo storage-js/fetch.
// Testado exaustivamente: @supabase/supabase-js .storage.upload() (com fetch
// nativo OU com undici) corrompe de forma consistente (~1.82x maior, header
// inválido) qualquer buffer com conteúdo real de imagem comprimida (JPEG e
// WebP, testado nos dois formatos) — buffers genéricos/aleatórios do mesmo
// tamanho sempre funcionam. Upload cru via https.request nunca corrompeu em
// nenhum teste. Bug isolado no SDK/fetch, não no backend do Supabase.
function uploadCru(bucket: string, path: string, buffer: Buffer, contentType: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host;
    const req = https.request(
      {
        hostname: host,
        path: `/storage/v1/object/${bucket}/${path}`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': contentType,
          'Content-Length': buffer.length,
        },
      },
      (res) => {
        if ((res.statusCode ?? 0) >= 300) {
          reject(new Error(`upload cru falhou: HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        res.resume();
        res.on('end', () => resolve());
      }
    );
    req.on('error', reject);
    req.write(buffer);
    req.end();
  });
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
        headers: { ...HEADERS_NAVEGADOR, Accept: 'image/*' },
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
      try {
        await uploadCru('painel', path, comprimida, 'image/webp');
      } catch {
        return null;
      }

      const publicUrl = supabase.storage.from('painel').getPublicUrl(path).data.publicUrl;

      // Já vimos o upload chegar corrompido no Storage (bytes binários viraram
      // caractere de substituição UTF-8) por algum motivo pontual do ambiente
      // serverless — sem isso, um post ia ao ar com imagem quebrada. Rebaixa e
      // valida antes de confiar na URL; se falhar, apaga o objeto e desiste.
      try {
        const conferencia = await fetch(publicUrl, { signal: AbortSignal.timeout(10000) });
        const bytes = Buffer.from(await conferencia.arrayBuffer());
        await sharp(bytes).metadata();
      } catch {
        await supabase.storage.from('painel').remove([path]);
        return null;
      }

      return publicUrl;
    },
    { fallback: null }
  );
}

// Normaliza URLs relativas/protocol-relative encontradas em <img src> e afins
// (ex.: "//site.com/img.jpg" ou "/wp-content/img.jpg") pra URL absoluta.
function normalizarUrl(url: string, baseUrl: string): string {
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return new URL(url, baseUrl).toString();
  return url;
}

function isImagemValida(url: string): boolean {
  if (!url) return false;
  if (!url.startsWith('http') && !url.startsWith('//') && !url.startsWith('/')) return false;
  const lower = url.toLowerCase();
  if (lower.endsWith('.svg') || lower.endsWith('.gif')) return false;
  if (lower.includes('favicon') || lower.includes('/icon') || lower.includes('logo')) return false;
  return true;
}

async function extrairOgImage(url: string): Promise<string | null> {
  return safeRun(
    async () => {
      const res = await fetch(url, {
        headers: HEADERS_NAVEGADOR,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const html = await res.text();

      // og:image
      const ogMatch =
        html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (ogMatch && isImagemValida(ogMatch[1])) return normalizarUrl(ogMatch[1], url);

      // twitter:image
      const twMatch =
        html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
      if (twMatch && isImagemValida(twMatch[1])) return normalizarUrl(twMatch[1], url);

      // Primeira <img> dentro de <article> ou <main>
      const bodyMatch = html.match(/<(?:article|main)[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
      if (bodyMatch && isImagemValida(bodyMatch[1])) return normalizarUrl(bodyMatch[1], url);

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
