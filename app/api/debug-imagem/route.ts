import { NextRequest, NextResponse } from 'next/server';
import { resolverImagem } from '@/lib/noticias/image-sourcer';

// Rota temporária só pra validar em produção se o upload de imagem
// (fetch do undici) para de corromper. Remover depois de confirmado.
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

  return NextResponse.json({ resultado });
}
