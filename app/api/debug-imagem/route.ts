import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetch as undiciFetch } from 'undici';
import sharp from 'sharp';

// Rota temporária só pra validar em produção se o upload de imagem
// (fetch do undici) para de corromper. Remover depois de confirmado.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== process.env.DEBUG_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const passos: Record<string, unknown> = {};
  const testeUrl = 'https://diariodocomercio.com.br/wp-content/uploads/2026/07/campo-industria.jpg';

  try {
    const res = await fetch(testeUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' },
      signal: AbortSignal.timeout(10000),
    });
    passos.download_status = res.status;
    passos.download_content_type = res.headers.get('content-type');
    const original = Buffer.from(await res.arrayBuffer());
    passos.download_bytes = original.length;

    const meta1 = await sharp(original).metadata();
    passos.sharp_original_ok = { format: meta1.format, width: meta1.width, height: meta1.height };

    const comprimida = await sharp(original).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
    passos.sharp_compress_ok = comprimida.length;

    const meta2 = await sharp(comprimida).metadata();
    passos.sharp_compress_metadata = { format: meta2.format, width: meta2.width, height: meta2.height };

    const path = `noticias/debug-${Date.now()}.webp`;
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { global: { fetch: undiciFetch as unknown as typeof fetch } }
    );
    const { error } = await supabase.storage.from('painel').upload(path, comprimida, { contentType: 'image/webp' });
    passos.upload_error = error?.message ?? null;

    if (!error) {
      const publicUrl = supabase.storage.from('painel').getPublicUrl(path).data.publicUrl;
      passos.public_url = publicUrl;
      passos.tamanho_enviado = comprimida.length;

      const conf = await fetch(publicUrl + '?cachebust=' + Date.now(), { signal: AbortSignal.timeout(10000), cache: 'no-store' });
      const bytesVoltando = Buffer.from(await conf.arrayBuffer());
      passos.bytes_voltando = bytesVoltando.length;
      passos.identico = bytesVoltando.equals(comprimida);
    }

    // Mesma imagem de origem, comprimida como JPEG em vez de WebP - se nao
    // corromper, o problema e especifico do formato/conteudo WebP (provavel
    // transformacao automatica de imagem no Cloudflare/Supabase na frente
    // do bucket, que reconhece e reprocessa WebP mas nao bytes aleatorios).
    const comoJpeg = await sharp(original).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    const pJpeg = `noticias/debug-comojpeg-${Date.now()}.jpg`;
    const { error: errJpeg } = await supabase.storage.from('painel').upload(pJpeg, comoJpeg, { contentType: 'image/jpeg' });
    if (errJpeg) {
      passos.teste_como_jpeg = { upload_error: errJpeg.message };
    } else {
      const uJpeg = supabase.storage.from('painel').getPublicUrl(pJpeg).data.publicUrl;
      const cJpeg = await fetch(uJpeg + '?cb=' + Date.now(), { cache: 'no-store' });
      const bJpeg = Buffer.from(await cJpeg.arrayBuffer());
      passos.teste_como_jpeg = {
        tam_enviado: comoJpeg.length,
        tam_recebido: bJpeg.length,
        identico: bJpeg.equals(comoJpeg),
      };
      try {
        const metaJpeg = await sharp(bJpeg).metadata();
        passos.teste_como_jpeg_sharp = { format: metaJpeg.format, width: metaJpeg.width, height: metaJpeg.height };
      } catch (e) {
        passos.teste_como_jpeg_sharp_erro = e instanceof Error ? e.message : String(e);
      }
    }
  } catch (e) {
    passos.erro_geral = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(passos);
}
