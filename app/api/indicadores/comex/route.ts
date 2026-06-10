import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export const revalidate = 3600; // cache 1h

export async function GET(req: NextRequest) {
  const uf  = req.nextUrl.searchParams.get('uf')  ?? 'ES';
  const tipo = req.nextUrl.searchParams.get('tipo') ?? 'EXP';
  const anos = parseInt(req.nextUrl.searchParams.get('anos') ?? '3');

  const anoAtual = new Date().getFullYear();
  const anoInicio = anoAtual - anos + 1;

  // 1. Evolução mensal (totais — capitulo IS NULL)
  const { data: evolucao, error: e1 } = await supabase
    .from('indicadores_comex')
    .select('ano, mes, vl_fob, kg_liquido')
    .eq('tipo', tipo)
    .eq('uf', uf)
    .is('capitulo', null)
    .gte('ano', anoInicio)
    .order('ano').order('mes');

  // 2. Top capítulos no ano atual
  const { data: topCapitulos, error: e2 } = await supabase
    .from('indicadores_comex')
    .select('capitulo, capitulo_desc, vl_fob')
    .eq('tipo', tipo)
    .eq('uf', uf)
    .eq('ano', anoAtual)
    .not('capitulo', 'is', null)
    .order('vl_fob', { ascending: false })
    .limit(10);

  // 3. Comparativo ES vs MG (totais anuais)
  const { data: comparativo, error: e3 } = await supabase
    .from('indicadores_comex')
    .select('uf, ano, vl_fob')
    .eq('tipo', tipo)
    .is('capitulo', null)
    .gte('ano', anoInicio)
    .in('uf', ['ES', 'MG'])
    .is('mes', null);

  // Total anual = soma dos meses
  const { data: totaisAnuais, error: e4 } = await supabase
    .from('indicadores_comex')
    .select('uf, ano, vl_fob')
    .eq('tipo', tipo)
    .is('capitulo', null)
    .gte('ano', anoInicio)
    .in('uf', ['ES', 'MG'])
    .order('uf').order('ano');

  // Agrupar totais anuais por UF e ano
  const anuais: Record<string, Record<number, number>> = { ES: {}, MG: {} };
  (totaisAnuais ?? []).forEach(r => {
    if (!anuais[r.uf]) anuais[r.uf] = {};
    anuais[r.uf][r.ano] = (anuais[r.uf][r.ano] ?? 0) + r.vl_fob;
  });

  if (e1 || e2 || e4) {
    return NextResponse.json({ error: e1?.message ?? e2?.message ?? e4?.message }, { status: 500 });
  }

  // Última atualização disponível
  const ultimoMes = evolucao?.at(-1);

  return NextResponse.json({
    uf,
    tipo,
    ultimoMes: ultimoMes ? { ano: ultimoMes.ano, mes: ultimoMes.mes } : null,
    evolucao: evolucao ?? [],
    topCapitulos: topCapitulos ?? [],
    comparativoAnual: anuais,
  });
}
