import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchCambio, fetchBrapi } from '@/lib/indicadores/fetchers';

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
    const cambio = await fetchCambio();
    for (const item of cambio) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('indicadores_snapshots').insert({
        slug: item.slug,
        value: item.value,
        variation: item.variation,
        raw_data: item.raw_data,
      });
      updated.push(item.slug);
    }
  } catch (e) {
    errors.push(`cambio: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const brapiMap = await fetchBrapi(['^BVSP', 'BZ=F']);
    const slugMap: Record<string, string> = { '^BVSP': 'ibovespa', 'BZ=F': 'petroleo' };
    for (const [symbol, slugName] of Object.entries(slugMap)) {
      const result = brapiMap.get(symbol);
      if (result) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('indicadores_snapshots').insert({
          slug: slugName,
          value: result.price,
          variation: result.changePct,
          raw_data: result.raw,
        });
        updated.push(slugName);
      } else {
        errors.push(`${slugName}: ticker ${symbol} não retornado`);
      }
    }
  } catch (e) {
    errors.push(`brapi: ${e instanceof Error ? e.message : String(e)}`);
  }

  return NextResponse.json({ ok: true, updated, errors });
}
