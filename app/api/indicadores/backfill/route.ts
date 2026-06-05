import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

function isAutorizado(req: NextRequest): boolean {
  return req.nextUrl.searchParams.get('secret') === process.env.CRON_SECRET;
}

type SnapshotRow = { slug: string; value: number; variation: number | null; captured_at: string; raw_data: Record<string, unknown> };

// Yahoo Finance: 30 dias de histórico diário
async function fetchYahooHistory(symbol: string, slug: string): Promise<SnapshotRow[]> {
  const res = await fetch(
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=30d`,
    {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortalMetalmecanica/1.0)' },
    }
  );
  if (!res.ok) throw new Error(`Yahoo ${symbol}: ${res.status}`);
  const data = await res.json() as {
    chart: { result?: Array<{
      timestamp: number[];
      indicators: { quote: Array<{ close: (number | null)[] }> };
    }> };
  };
  const result = data.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo ${symbol}: sem dados`);

  const timestamps = result.timestamp;
  const closes = result.indicators.quote[0].close;
  const rows: SnapshotRow[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close == null) continue;
    const prev = i > 0 ? closes[i - 1] : null;
    const variation = prev != null && prev !== 0 ? ((close - prev) / prev) * 100 : null;
    const captured_at = new Date(timestamps[i] * 1000).toISOString();
    rows.push({ slug, value: close, variation, captured_at, raw_data: { symbol, close, timestamp: timestamps[i] } });
  }
  return rows;
}

// BCB: 30 dias de Selic meta (série 432)
async function fetchSelicHistory(): Promise<SnapshotRow[]> {
  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - 35);
  const fmt = (d: Date) => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;

  const res = await fetch(
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados?formato=json&dataInicial=${fmt(inicio)}&dataFinal=${fmt(hoje)}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`BCB Selic: ${res.status}`);
  const data = await res.json() as Array<{ data: string; valor: string }>;

  return data.map((item, i) => {
    const value = parseFloat(item.valor);
    const prev = i > 0 ? parseFloat(data[i - 1].valor) : null;
    const variation = prev != null ? value - prev : null;
    const [d, m, y] = item.data.split('/');
    const captured_at = new Date(`${y}-${m}-${d}T15:00:00Z`).toISOString();
    return { slug: 'selic', value, variation, captured_at, raw_data: item as unknown as Record<string, unknown> };
  });
}

// open.er-api.com não tem histórico — usa Yahoo Finance para USD/BRL e EUR/BRL
async function fetchCambioHistory(): Promise<SnapshotRow[]> {
  const [usd, eur] = await Promise.all([
    fetchYahooHistory('USDBRL=X', 'dolar'),
    fetchYahooHistory('EURBRL=X', 'euro'),
  ]);
  return [...usd, ...eur];
}

// MDIC: histórico mensal de 2 anos em 2 requisições (range)
async function fetchExportacoesHistory(): Promise<SnapshotRow[]> {
  const now = new Date();
  const endRef = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const startRef = new Date(endRef.getFullYear() - 2, endRef.getMonth(), 1);
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const res = await fetch('https://api-comexstat.mdic.gov.br/general', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flow: 'export',
      monthDetail: true,
      period: { from: fmt(startRef), to: fmt(endRef) },
      details: ['state'],
      metrics: ['metricFOB'],
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`MDIC backfill: ${res.status}`);
  const data = await res.json() as { data?: { list?: Array<{ state: string; year: string; monthNumber: string; metricFOB?: string }> } };

  // Agrupa por estado+ano+mês
  const byStatePeriod: Record<string, number> = {};
  for (const r of data.data?.list ?? []) {
    const key = `${r.state}_${r.year}_${String(r.monthNumber).padStart(2, '0')}`;
    byStatePeriod[key] = parseInt(r.metricFOB ?? '0', 10);
  }

  const rows: SnapshotRow[] = [];
  const states = [{ name: 'Espírito Santo', slug: 'exportacoes_es' }, { name: 'Minas Gerais', slug: 'exportacoes_mg' }];

  for (const { name, slug } of states) {
    const keys = Object.keys(byStatePeriod).filter(k => k.startsWith(name + '_')).sort();
    for (const key of keys) {
      const parts = key.split('_');
      const year = parseInt(parts[parts.length - 2]);
      const month = parseInt(parts[parts.length - 1]) - 1;
      const value = byStatePeriod[key];
      if (value === 0) continue;

      const prevKey = `${name}_${year - 1}_${String(month + 1).padStart(2, '0')}`;
      const prevValue = byStatePeriod[prevKey] ?? 0;
      const yoy = prevValue > 0 ? Math.round(((value - prevValue) / prevValue) * 1000) / 10 : null;
      const captured_at = new Date(year, month + 1, 1, 12, 0, 0).toISOString();

      rows.push({ slug, value: Math.round(value / 1_000_000), variation: yoy, captured_at, raw_data: { state: name, year, month: month + 1 } as Record<string, unknown> });
    }
  }
  return rows;
}

// IBGE PIM: histórico mensal de 24 meses para ES e MG
async function fetchProducaoHistory(): Promise<SnapshotRow[]> {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const start = new Date(end.getFullYear() - 2, end.getMonth(), 1);
  const toPeriod = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;

  const url = `https://apisidra.ibge.gov.br/values/t/8888/n3/32,31/v/11602,12606/p/${toPeriod(start)}-${toPeriod(end)}/c544/129314`;
  const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'PortalMetalmecanica/1.0' } });
  if (!res.ok) throw new Error(`IBGE PIM backfill: ${res.status}`);

  const all = await res.json() as Array<Record<string, string>>;
  const data = all.slice(1);

  // Agrupa por estado+período
  const byStatePeriod: Record<string, { yoy?: number; index?: number }> = {};
  for (const row of data) {
    const key = `${row['D1C']}_${row['D3C']}`;
    const v = row['V'];
    if (!v || v === '...' || v === '..' || v === '-') continue;
    const num = parseFloat(v);
    if (isNaN(num)) continue;
    if (!byStatePeriod[key]) byStatePeriod[key] = {};
    if (row['D2C'] === '11602') byStatePeriod[key].yoy = Math.round(num * 10) / 10;
    if (row['D2C'] === '12606') byStatePeriod[key].index = Math.round(num * 10) / 10;
  }

  const rows: SnapshotRow[] = [];
  for (const [key, d] of Object.entries(byStatePeriod)) {
    if (d.index === undefined && d.yoy === undefined) continue;
    const [stateId, period] = key.split('_');
    const slug = stateId === '32' ? 'producao_es' : 'producao_mg';
    const year = parseInt(period.substring(0, 4));
    const month = parseInt(period.substring(4)) - 1;
    const captured_at = new Date(year, month + 1, 1, 12, 0, 0).toISOString();
    rows.push({ slug, value: d.index ?? 0, variation: d.yoy ?? null, captured_at, raw_data: { stateId, period } as Record<string, unknown> });
  }
  return rows;
}

export async function POST(req: NextRequest) {
  if (!isAutorizado(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const results: Record<string, number> = {};
  const errors: string[] = [];

  // Busca todos os históricos em paralelo
  const jobs: Array<{ name: string; fn: () => Promise<SnapshotRow[]> }> = [
    { name: 'cambio', fn: fetchCambioHistory },
    { name: 'ibovespa', fn: () => fetchYahooHistory('^BVSP', 'ibovespa') },
    { name: 'petroleo', fn: () => fetchYahooHistory('BZ=F', 'petroleo') },
    { name: 'selic', fn: fetchSelicHistory },
    { name: 'minerio', fn: () => fetchYahooHistory('TIO=F', 'minerio') },
    { name: 'aco', fn: () => fetchYahooHistory('HRC=F', 'aco') },
    { name: 'aluminio', fn: () => fetchYahooHistory('ALI=F', 'aluminio') },
    { name: 'cobre', fn: () => fetchYahooHistory('HG=F', 'cobre') },
    { name: 'exportacoes_regional', fn: fetchExportacoesHistory },
    { name: 'producao_regional', fn: fetchProducaoHistory },
  ];

  for (const job of jobs) {
    try {
      const rows = await job.fn();
      if (rows.length === 0) { errors.push(`${job.name}: sem dados`); continue; }

      // Insere em lote de 50
      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('indicadores_snapshots').insert(batch);
      }
      results[job.name] = rows.length;
    } catch (e) {
      errors.push(`${job.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const total = Object.values(results).reduce((a, b) => a + b, 0);
  return NextResponse.json({ ok: true, total, results, errors });
}
