import { NextRequest, NextResponse } from 'next/server';
import { generateText } from '@/lib/noticias/ai-provider';

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const result = await generateText('Escreva exatamente esta frase: REWRITER_FUNCIONANDO');
    return NextResponse.json({ ok: true, result: result.substring(0, 200) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) });
  }
}
