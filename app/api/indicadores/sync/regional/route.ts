import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchExportacoesRegional, fetchProducaoRegional } from '@/lib/indicadores/fetchers';

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

  // Exportações ES e MG separadas (MDIC Comex Stat)
  try {
    const exportacoes = await fetchExportacoesRegional();
    for (const item of exportacoes) {
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
    errors.push(`exportacoes: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Produção Industrial ES e MG separadas (IBGE SIDRA PIM-PF Regional)
  try {
    const producao = await fetchProducaoRegional();
    for (const item of producao) {
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
    errors.push(`producao: ${e instanceof Error ? e.message : String(e)}`);
  }

  return NextResponse.json({ ok: true, updated, errors });
}
