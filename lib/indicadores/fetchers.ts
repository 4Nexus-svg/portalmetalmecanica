export type IndicadorFetch = {
  slug: string;
  value: number;
  variation: number | null;
  raw_data: Record<string, unknown>;
};

// AwesomeAPI: Dolar e Euro
export async function fetchCambio(): Promise<IndicadorFetch[]> {
  const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL', {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`AwesomeAPI error: ${res.status}`);
  const data = await res.json();
  return [
    {
      slug: 'dolar',
      value: parseFloat(data.USDBRL.bid),
      variation: parseFloat(data.USDBRL.pctChange),
      raw_data: data.USDBRL,
    },
    {
      slug: 'euro',
      value: parseFloat(data.EURBRL.bid),
      variation: parseFloat(data.EURBRL.pctChange),
      raw_data: data.EURBRL,
    },
  ];
}

// brapi.dev: ^BVSP=Ibovespa, BZ=F=Brent, TIO=F=Minerio, HRC=F=Aco, ALI=F=Aluminio, HG=F=Cobre
export async function fetchBrapi(
  symbols: string[]
): Promise<Map<string, { price: number; changePct: number; raw: Record<string, unknown> }>> {
  const query = symbols.join(',');
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

// Banco Central OLINDA: Selic (serie 11)
export async function fetchSelic(): Promise<IndicadorFetch> {
  const res = await fetch(
    'https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados/ultimos/1?formato=json',
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

// MDIC Comex Stat: Exportacoes ES (32) e MG (31) em US$ FOB milhoes
export async function fetchExportacoes(): Promise<IndicadorFetch> {
  const now = new Date();
  // MDIC publica com ~1 mes de atraso
  const ref = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const period = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}`;

  const res = await fetch('https://api-comexstat.mdic.gov.br/cities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flow: 'exp',
      monthDetail: false,
      period: { from: period, to: period },
      filters: [{ filter: 'state', values: ['32', '31'] }],
      details: ['state'],
      metrics: ['metricFOB'],
    }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`MDIC error: ${res.status}`);
  const data = (await res.json()) as { data?: Array<{ metricFOB?: number }> };
  const totalUSD = (data.data ?? []).reduce((sum, row) => sum + (row.metricFOB ?? 0), 0);
  return {
    slug: 'exportacoes',
    value: Math.round((totalUSD / 1_000_000) * 10) / 10,
    variation: null,
    raw_data: data as unknown as Record<string, unknown>,
  };
}

// IBGE SIDRA: Producao Industrial estadual PIM (tabela 3653, variavel 3135)
// N3[32]=ES, N3[31]=MG — media dos indices dos dois estados
export async function fetchProducaoIndustrial(): Promise<IndicadorFetch> {
  const res = await fetch(
    'https://servicodados.ibge.gov.br/api/v3/agregados/3653/periodos/last/variaveis/3135?localidades=N3[32,31]',
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`IBGE error: ${res.status}`);
  const data = (await res.json()) as Array<{
    resultados?: Array<{
      series?: Array<{ serie?: Record<string, string> }>;
    }>;
  }>;

  let total = 0;
  let count = 0;
  try {
    const series = data[0]?.resultados?.[0]?.series ?? [];
    for (const s of series) {
      const values = Object.values(s.serie ?? {});
      const last = parseFloat(values[values.length - 1] ?? '0');
      if (!isNaN(last)) {
        total += last;
        count++;
      }
    }
  } catch {}

  return {
    slug: 'producao',
    value: count > 0 ? Math.round((total / count) * 10) / 10 : 0,
    variation: null,
    raw_data: data as unknown as Record<string, unknown>,
  };
}
