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

// IBGE SIDRA: PIM-PF Regional, tabela 8888
// var 11602 = variação M/M-12 (YoY %), var 12606 = índice base 2022=100
// c544/129314 = "1 Indústria geral", ES (N3[32]) e MG (N3[31]) separados
export async function fetchProducaoRegional(): Promise<IndicadorFetch[]> {
  const now = new Date();
  const toPeriod = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;

  // Tenta de 2 a 4 meses atrás até encontrar período com dados publicados
  let rows: Array<Record<string, string>> = [];
  for (let lag = 2; lag <= 4; lag++) {
    const ref = new Date(now.getFullYear(), now.getMonth() - lag, 1);
    const url = `https://apisidra.ibge.gov.br/values/t/8888/n3/32,31/v/11602,12606/p/${toPeriod(ref)}/c544/129314`;
    const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'PortalMetalmecanica/1.0' } });
    if (!res.ok) continue;
    const parsed = await res.json() as Array<Record<string, string>>;
    const hasData = parsed.slice(1).some(r => {
      const v = r['V'];
      return v && v !== '..' && v !== '...' && v !== '-' && !isNaN(parseFloat(v));
    });
    if (hasData) { rows = parsed; break; }
  }

  if (rows.length === 0) return [];
  const data = rows.slice(1); // descarta linha de cabeçalho

  const byState: Record<string, { yoy: number | null; index: number | null; period: string }> = {};

  for (const row of data) {
    const stateId = row['D1C'];
    const varCode = row['D2C'];
    const value = row['V'];
    const period = row['D3C'];
    if (!stateId || !value || value === '..' || value === '...' || value === '-') continue;

    if (!byState[stateId]) byState[stateId] = { yoy: null, index: null, period };
    const num = parseFloat(value);
    if (isNaN(num)) continue;

    if (varCode === '11602') byState[stateId].yoy = Math.round(num * 10) / 10;
    if (varCode === '12606') byState[stateId].index = Math.round(num * 10) / 10;
  }

  const results: IndicadorFetch[] = [];
  for (const [stateId, d] of Object.entries(byState)) {
    const slug = stateId === '32' ? 'producao_es' : 'producao_mg';
    if (d.index === null && d.yoy === null) continue;
    results.push({
      slug,
      value: d.index ?? 0,
      variation: d.yoy,
      raw_data: { stateId, period: d.period, index: d.index, yoy: d.yoy } as unknown as Record<string, unknown>,
    });
  }
  return results;
}
