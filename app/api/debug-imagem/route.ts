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

    // Teste de controle: buffer pequeno e simples, sem sharp, pra isolar se o
    // bug e generico do upload (qualquer buffer) ou especifico de buffer de imagem.
    const textoSimples = Buffer.from(`teste-simples-${Date.now()}-${'x'.repeat(50)}`);
    const pathTexto = `noticias/debug-texto-${Date.now()}.txt`;
    const { error: errTexto } = await supabase.storage.from('painel').upload(pathTexto, textoSimples, { contentType: 'text/plain' });
    passos.controle_texto_enviado_bytes = textoSimples.length;
    passos.controle_texto_upload_error = errTexto?.message ?? null;
    if (!errTexto) {
      const urlTexto = supabase.storage.from('painel').getPublicUrl(pathTexto).data.publicUrl;
      const confTexto = await fetch(urlTexto + '?cachebust=' + Date.now(), { cache: 'no-store' });
      const bytesTexto = Buffer.from(await confTexto.arrayBuffer());
      passos.controle_texto_recebido_bytes = bytesTexto.length;
      passos.controle_texto_identico = bytesTexto.equals(textoSimples);
      passos.controle_texto_conteudo = bytesTexto.toString('utf8').slice(0, 100);
    }
  } catch (e) {
    passos.erro_geral = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(passos);
}
