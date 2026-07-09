import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetch as undiciFetch } from 'undici';
import sharp from 'sharp';
import { randomBytes } from 'crypto';

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

    // Teste decisivo: buffer com bytes ALEATORIOS de verdade (nao repetido),
    // mesmo tamanho, content-type generico. Se corromper igual, confirma que
    // e um bug de encoding binario->texto (byte invalido UTF-8 vira lixo),
    // nao algo especifico de "ser uma imagem".
    const bufAleatorio = randomBytes(143134);
    const pAleatorio = `noticias/debug-random-${Date.now()}.bin`;
    const { error: errAleatorio } = await supabase.storage.from('painel').upload(pAleatorio, bufAleatorio, { contentType: 'application/octet-stream' });
    if (errAleatorio) {
      passos.teste_bytes_aleatorios = { upload_error: errAleatorio.message };
    } else {
      const uAleatorio = supabase.storage.from('painel').getPublicUrl(pAleatorio).data.publicUrl;
      const cAleatorio = await fetch(uAleatorio + '?cb=' + Date.now(), { cache: 'no-store' });
      const bAleatorio = Buffer.from(await cAleatorio.arrayBuffer());
      passos.teste_bytes_aleatorios = {
        tam_enviado: bufAleatorio.length,
        tam_recebido: bAleatorio.length,
        identico: bAleatorio.equals(bufAleatorio),
        razao: bAleatorio.length / bufAleatorio.length,
      };
    }
  } catch (e) {
    passos.erro_geral = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(passos);
}
