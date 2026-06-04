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
    { name: 'ibovespa', fn: () => fetchYahooHistory('%5EBVSP', 'ibovespa') },
    { name: 'petroleo', fn: () => fetchYahooHistory('BZ=F', 'petroleo') },
    { name: 'selic', fn: fetchSelicHistory },
    { name: 'minerio', fn: () => fetchYahooHistory('TIO=F', 'minerio') },
    { name: 'aco', fn: () => fetchYahooHistory('HRC=F', 'aco') },
    { name: 'aluminio', fn: () => fetchYahooHistory('ALI=F', 'aluminio') },
    { name: 'cobre', fn: () => fetchYahooHistory('HG=F', 'cobre') },
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
