import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchCambio, fetchBrapi, fetchYahoo } from '@/lib/indicadores/fetchers';

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

  // Ibovespa via brapi.dev
  try {
    const brapiMap = await fetchBrapi(['^BVSP']);
    const result = brapiMap.get('^BVSP');
    if (result) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('indicadores_snapshots').insert({
        slug: 'ibovespa', value: result.price, variation: result.changePct, raw_data: result.raw,
      });
      updated.push('ibovespa');
    } else {
      errors.push('ibovespa: ticker não retornado');
    }
  } catch (e) {
    errors.push(`ibovespa: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Petróleo Brent via Yahoo Finance
  try {
    const brent = await fetchYahoo('BZ=F');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('indicadores_snapshots').insert({
      slug: 'petroleo', value: brent.price, variation: brent.changePct, raw_data: brent.raw,
    });
    updated.push('petroleo');
  } catch (e) {
    errors.push(`petroleo: ${e instanceof Error ? e.message : String(e)}`);
  }

  return NextResponse.json({ ok: true, updated, errors });
}
