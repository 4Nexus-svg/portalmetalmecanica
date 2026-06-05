export type IndicadorFetch = {
  slug: string;
  value: number;
  variation: number | null;
  raw_data: Record<string, unknown>;
};

// open.er-api.com: Dolar e Euro (gratis, sem chave, sem rate limit)
export async function fetchCambio(): Promise<IndicadorFetch[]> {
  const [resUSD, resEUR] = await Promise.all([
    fetch('https://open.er-api.com/v6/latest/USD', { cache: 'no-store' }),
    fetch('https://open.er-api.com/v6/latest/EUR', { cache: 'no-store' }),
  ]);
  if (!resUSD.ok) throw new Error(`ExchangeRate USD error: ${resUSD.status}`);
  if (!resEUR.ok) throw new Error(`ExchangeRate EUR error: ${resEUR.status}`);

  const usd = await resUSD.json() as { rates: Record<string, number>; result: string };
  const eur = await resEUR.json() as { rates: Record<string, number>; result: string };

  return [
    {
      slug: 'dolar',
      value: usd.rates['BRL'] ?? 0,
      variation: null,
      raw_data: usd as unknown as Record<string, unknown>,
    },
    {
      slug: 'euro',
      value: eur.rates['BRL'] ?? 0,
      variation: null,
      raw_data: eur as unknown as Record<string, unknown>,
    },
  ];
}

// brapi.dev: usado apenas para Ibovespa (^BVSP) — requer BRAPI_TOKEN
export async function fetchBrapi(
  symbols: string[]
): Promise<Map<string, { price: number; changePct: number; raw: Record<string, unknown> }>> {
  const query = symbols.map(encodeURIComponent).join(',');
  const token = process.env.BRAPI_TOKEN;
  const url = `https://brapi.dev/api/quote/${query}${token ? `?token=${token}` : ''}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`brapi.dev error: ${res.status}`);
  const data = await res.json();
  const map = new Map<string, { price: number; changePct: number; raw: Record<string, unknown> }>();
  for (const r of (data.results ?? []) as Array<Record<string, unknown>>) {
    map.set(r.symbol as string, {
      price: r.regularMarketPrice as number,
      changePct: r.regularMarketChangePercent as number,
      raw: r,
    });
  }
  return map;
}

// Yahoo Finance v2: para commodities e futuros (BZ=F, TIO=F, HRC=F, ALI=F, HG=F) — sem autenticação
export async function fetchYahoo(
  symbol: string
): Promise<{ price: number; changePct: number; raw: Record<string, unknown> }> {
  const res = await fetch(
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`,
    {
      cache: 'no-store',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortalMetalmecanica/1.0)' },
    }
  );
  if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status} for ${symbol}`);
  const data = await res.json() as { chart?: { result?: Array<{ meta?: Record<string, unknown> }> } };
  const meta = data.chart?.result?.[0]?.meta;
  if (!meta) throw new Error(`Yahoo Finance: sem dados para ${symbol}`);
  const price = meta.regularMarketPrice as number;
  const prevClose = (meta.chartPreviousClose ?? meta.previousClose) as number | undefined;
  const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
  return { price, changePct, raw: meta };
}

// Banco Central OLINDA: Selic (serie 11)
export async function fetchSelic(): Promise<IndicadorFetch> {
  const res = await fetch(
    'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json',
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`BCB error: ${res.status}`);
  const [data] = (await res.json()) as Array<{ data: string; valor: string }>;
  return {
    slug: 'selic',
    value: parseFloat(data.valor),
    variation: null,
    raw_data: data as unknown as Record<string, unknown>,
  };
}

// MDIC Comex Stat: Exportacoes ES e MG separadas, com variacao YoY
// Usa endpoint /general com flow=export, filtra por nome do estado no resultado
export async function fetchExportacoesRegional(): Promise<IndicadorFetch[]> {
  const now = new Date();
  // MDIC publica com ~2 meses de atraso
  const ref = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const prevYear = new Date(ref.getFullYear() - 1, ref.getMonth(), 1);
  const fmtPeriod = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const fetchComex = async (period: string): Promise<Record<string, number>> => {
    const res = await fetch('https://api-comexstat.mdic.gov.br/general', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flow: 'export',
        monthDetail: false,
        period: { from: period, to: period },
        details: ['state'],
        metrics: ['metricFOB'],
      }),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`MDIC error: ${res.status}`);
    const data = await res.json() as { data?: { list?: Array<{ state: string; metricFOB?: string }> } };
    const map: Record<string, number> = {};
    for (const row of data.data?.list ?? []) {
      map[row.state] = parseInt(row.metricFOB ?? '0', 10);
    }
    return map;
  };

  const [current, lastYear] = await Promise.all([
    fetchComex(fmtPeriod(ref)),
    fetchComex(fmtPeriod(prevYear)),
  ]);

  const toMi = (v: number) => Math.round(v / 1_000_000);
  const yoy = (cur: number, prev: number): number | null =>
    prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null;

  const esC = current['Espírito Santo'] ?? 0;
  const esP = lastYear['Espírito Santo'] ?? 0;
  const mgC = current['Minas Gerais'] ?? 0;
  const mgP = lastYear['Minas Gerais'] ?? 0;
  const period = fmtPeriod(ref);

  return [
    {
      slug: 'exportacoes_es',
      value: toMi(esC),
      variation: yoy(esC, esP),
      raw_data: { state: 'ES', period, fob_usd: esC, fob_usd_prev_year: esP } as unknown as Record<string, unknown>,
    },
    {
      slug: 'exportacoes_mg',
      value: toMi(mgC),
      variation: yoy(mgC, mgP),
      raw_data: { state: 'MG', period, fob_usd: mgC, fob_usd_prev_year: mgP } as unknown as Record<string, unknown>,
    },
  ];
}

// IBGE SIDRA: PIM-PF Regional, tabela 3653, variavel 3135 (indice base fixa)
// ES (N3[32]) e MG (N3[31]) separados, com variacao interanual (YoY)
export async function fetchProducaoRegional(): Promise<IndicadorFetch[]> {
  const now = new Date();
  // IBGE publica com ~45 dias de atraso
  const ref = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const startRef = new Date(ref.getFullYear() - 1, ref.getMonth() - 1, 1);
  const toPeriod = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;

  const url = `https://servicodados.ibge.gov.br/api/v3/agregados/3653/periodos/${toPeriod(startRef)}-${toPeriod(ref)}/variaveis/3135?localidades=N3[32,31]`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`IBGE PIM error: ${res.status}`);

  const data = await res.json() as Array<{
    resultados?: Array<{
      series?: Array<{
        localidade: { id: string };
        serie: Record<string, string>;
      }>;
    }>;
  }>;

  const results: IndicadorFetch[] = [];

  for (const varResult of data) {
    for (const result of varResult.resultados ?? []) {
      for (const series of result.series ?? []) {
        const stateId = series.localidade.id;
        const slug = stateId === '32' ? 'producao_es' : 'producao_mg';
        const serie = series.serie;

        const periods = Object.keys(serie).filter(k => serie[k] !== '...').sort();
        if (periods.length === 0) continue;

        const latestPeriod = periods[periods.length - 1];
        const latestValue = parseFloat(serie[latestPeriod]);
        if (isNaN(latestValue)) continue;

        // YoY: mesmo mes do ano anterior
        const prevPeriod = `${parseInt(latestPeriod.substring(0, 4)) - 1}${latestPeriod.substring(4)}`;
        const prevValue = serie[prevPeriod] ? parseFloat(serie[prevPeriod]) : null;
        const yoy = prevValue && prevValue > 0 ? ((latestValue - prevValue) / prevValue) * 100 : null;

        results.push({
          slug,
          value: Math.round(latestValue * 10) / 10,
          variation: yoy !== null ? Math.round(yoy * 10) / 10 : null,
          raw_data: { stateId, latestPeriod, latestValue, prevPeriod, prevValue } as unknown as Record<string, unknown>,
        });
      }
    }
  }

  return results;
}
