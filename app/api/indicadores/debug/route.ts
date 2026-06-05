import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    // Simula exatamente o que o fetcher faz
    const { fetchProducaoRegional } = await import('@/lib/indicadores/fetchers');
    const result = await fetchProducaoRegional();
    return NextResponse.json({ result, count: result.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }
}
