import { NextRequest, NextResponse } from 'next/server';
import { resolverImagem } from '@/lib/noticias/image-sourcer';
import sharp from 'sharp';

// Rota temporária pra validar em produção o fix do upload cru (https.request).
// Remover depois de confirmado.
export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== process.env.DEBUG_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const testeUrl = 'https://diariodocomercio.com.br/wp-content/uploads/2026/07/campo-industria.jpg';
  const resultado = await resolverImagem({
    titulo: 'teste-debug',
    url: 'https://example.com/teste',
    conteudo: '',
    imagemUrl: testeUrl,
    publicadoEm: new Date(),
    fonteNome: 'debug',
    tipoFonte: 'rss-geral',
  });

  if (!resultado) return NextResponse.json({ resultado: null });

  const conf = await fetch(resultado, { cache: 'no-store' });
  const bytes = Buffer.from(await conf.arrayBuffer());
  try {
    const meta = await sharp(bytes).metadata();
    return NextResponse.json({ resultado, valida: true, meta: { format: meta.format, width: meta.width, height: meta.height } });
  } catch (e) {
    return NextResponse.json({ resultado, valida: false, erro: e instanceof Error ? e.message : String(e) });
  }
}
