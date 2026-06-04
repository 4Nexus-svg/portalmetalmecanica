import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchSelic, fetchBrapi } from '@/lib/indicadores/fetchers';

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

  // TIO=F=Minerio, HRC=F=Aco, ALI=F=Aluminio, HG=F=Cobre
  try {
    const brapiMap = await fetchBrapi(['TIO=F', 'HRC=F', 'ALI=F', 'HG=F']);
    const slugMap: Record<string, string> = {
      'TIO=F': 'minerio',
      'HRC=F': 'aco',
      'ALI=F': 'aluminio',
      'HG=F': 'cobre',
    };
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
