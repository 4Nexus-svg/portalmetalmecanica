import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchSelic, fetchYahoo } from '@/lib/indicadores/fetchers';

function isAutorizado(req: NextRequest): boolean {
  return req.nextUrl.searchParams.get('secret') === process.env.CRON_SECRET;
}

export async function POST(req: NextRequest) {
  if (!isAutorizado(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const updated: string[] = [];
  const errors: string[] = [];

  try {
    const selic = await fetchSelic();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('indicadores_snapshots').insert({
      slug: selic.slug,
      value: selic.value,
      variation: selic.variation,
      raw_data: selic.raw_data,
    });
    updated.push('selic');
  } catch (e) {
    errors.push(`selic: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Commodities via Yahoo Finance (TIO=F=Minerio, HRC=F=Aco, ALI=F=Aluminio, HG=F=Cobre)
  const commodities: Array<{ symbol: string; slug: string }> = [
    { symbol: 'TIO=F', slug: 'minerio' },
    { symbol: 'HRC=F', slug: 'aco' },
    { symbol: 'ALI=F', slug: 'aluminio' },
    { symbol: 'HG=F',  slug: 'cobre' },
  ];
  for (const { symbol, slug } of commodities) {
    try {
      const result = await fetchYahoo(symbol);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('indicadores_snapshots').insert({
        slug, value: result.price, variation: result.changePct, raw_data: result.raw,
      });
      updated.push(slug);
    } catch (e) {
      errors.push(`${slug}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, updated, errors });
}
