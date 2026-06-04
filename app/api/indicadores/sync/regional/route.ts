import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchExportacoes, fetchProducaoIndustrial } from '@/lib/indicadores/fetchers';

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
    const exp = await fetchExportacoes();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('indicadores_snapshots').insert({
      slug: exp.slug,
      value: exp.value,
      variation: exp.variation,
      raw_data: exp.raw_data,
    });
    updated.push('exportacoes');
  } catch (e) {
    errors.push(`exportacoes: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const prod = await fetchProducaoIndustrial();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('indicadores_snapshots').insert({
      slug: prod.slug,
      value: prod.value,
      variation: prod.variation,
      raw_data: prod.raw_data,
    });
    updated.push('producao');
  } catch (e) {
    errors.push(`producao: ${e instanceof Error ? e.message : String(e)}`);
  }

  return NextResponse.json({ ok: true, updated, errors });
}
