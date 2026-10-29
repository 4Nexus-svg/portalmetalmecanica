import sharp from 'sharp';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Imagem de compartilhamento (og:image) da notícia em JPG 1200x630.
 *
 * As imagens do bucket `painel` são WebP (ver lib/noticias/image-sourcer.ts) e
 * o WhatsApp não mostra a foto no cartão do link quando o og:image é WebP.
 * Converte sob demanda; a CDN da Vercel guarda o resultado por 1 dia.
 */

const MAX_BYTES = 10 * 1024 * 1024;

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // Só notícia publicada — a rota não pode virar proxy de imagem arbitrária.
  const { data } = (await (await createServiceClient())
    .from('posts')
    .select('featured_image')
    .not('published_at', 'is', null)
    .eq('slug', slug)
    .maybeSingle()) as { data: { featured_image: string | null } | null; error: unknown };
  const imageUrl = data?.featured_image ?? null;
  if (!imageUrl) return new Response('Not found', { status: 404 });

  // Só busca do nosso Storage (anti-SSRF): featured_image editado no painel pode
  // apontar pra qualquer host. Fora dele, devolve a URL original sem converter.
  const storageHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host;
  const alvo = new URL(imageUrl);
  if (alvo.protocol !== 'https:' || alvo.host !== storageHost) {
    return Response.redirect(imageUrl, 302);
  }

  try {
    const original = await fetch(alvo, { redirect: 'error', signal: AbortSignal.timeout(8000) });
    const tamanho = Number(original.headers.get('content-length') ?? 0);
    if (!original.ok || tamanho > MAX_BYTES) return new Response('Bad gateway', { status: 502 });
    const buffer = Buffer.from(await original.arrayBuffer());
    if (buffer.length > MAX_BYTES) return new Response('Bad gateway', { status: 502 });

    // ~100 KB: o WhatsApp descarta prévias com imagem muito pesada.
    const jpg = await sharp(buffer, { limitInputPixels: 40_000_000 })
      .resize(1200, 630, { fit: 'cover' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();

    return new Response(new Uint8Array(jpg), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    });
  } catch {
    return new Response('Bad gateway', { status: 502 });
  }
}
