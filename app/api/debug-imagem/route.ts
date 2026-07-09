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

    // O mesmo buffer real (comprimida) sobe 3x seguidas - e sempre a mesma
    // corrupcao (bug deterministico do conteudo) ou um retry resolve?
    const repeticoes: unknown[] = [];
    for (let i = 0; i < 3; i++) {
      const p = `noticias/debug-retry-${i}-${Date.now()}.webp`;
      const { error: errR } = await supabase.storage.from('painel').upload(p, comprimida, { contentType: 'image/webp' });
      if (errR) { repeticoes.push({ i, upload_error: errR.message }); continue; }
      const u = supabase.storage.from('painel').getPublicUrl(p).data.publicUrl;
      const c = await fetch(u + '?cb=' + Date.now(), { cache: 'no-store' });
      const b = Buffer.from(await c.arrayBuffer());
      repeticoes.push({ i, tam_recebido: b.length, identico: b.equals(comprimida) });
    }
    passos.repeticoes_mesmo_buffer = repeticoes;

    // Sharp com toBuffer({ resolveWithObject: false }) explicito e sem
    // encadear .resize().webp() na mesma chain - gera o buffer em 2 passos
    // separados, pra ver se o encadeamento influencia.
    const etapa1 = await sharp(original).resize({ width: 1200, withoutEnlargement: true }).toBuffer();
    const comprimida2 = await sharp(etapa1).webp({ quality: 75 }).toBuffer();
    const pDuasEtapas = `noticias/debug-duasetapas-${Date.now()}.webp`;
    const { error: errDuas } = await supabase.storage.from('painel').upload(pDuasEtapas, comprimida2, { contentType: 'image/webp' });
    if (!errDuas) {
      const uDuas = supabase.storage.from('painel').getPublicUrl(pDuasEtapas).data.publicUrl;
      const cDuas = await fetch(uDuas + '?cb=' + Date.now(), { cache: 'no-store' });
      const bDuas = Buffer.from(await cDuas.arrayBuffer());
      passos.teste_duas_etapas = {
        tam_enviado: comprimida2.length,
        tam_recebido: bDuas.length,
        identico: bDuas.equals(comprimida2),
      };
    }
  } catch (e) {
    passos.erro_geral = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(passos);
}
