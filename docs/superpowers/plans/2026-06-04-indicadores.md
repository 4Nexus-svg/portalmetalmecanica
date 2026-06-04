# Indicadores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a seção Indicadores com 11 indicadores econômicos/industriais atualizados via cron (cron-job.org → API routes → Supabase), página principal estilo InfoMoney com cards + sparklines e páginas de detalhe com gráfico histórico interativo.

**Architecture:** Crons externos (cron-job.org) chamam rotas `POST /api/indicadores/sync/*` protegidas por `CRON_SECRET`. As rotas buscam APIs externas gratuitas e inserem snapshots no Supabase. As páginas leem do banco via Server Components (ISR 300s) e renderizam os dados com componentes Tailwind + Recharts.

**Tech Stack:** Next.js App Router, Supabase (service role para INSERT, anon para SELECT), Tailwind CSS, Recharts (gráfico de detalhe), SVG inline (sparkline da página principal), AwesomeAPI, brapi.dev, BCB OLINDA, MDIC Comex Stat, IBGE SIDRA.

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/008_indicadores.sql` | Criar | Tabelas `indicadores_snapshots` e `indicadores_config` + índices + RLS |
| `types/database.ts` | Modificar | Adicionar tipos das 2 novas tabelas |
| `lib/indicadores/fetchers.ts` | Criar | Funções que buscam cada API externa (AwesomeAPI, brapi.dev, BCB, MDIC, IBGE) |
| `lib/indicadores/queries.ts` | Criar | Queries Supabase: últimos snapshots, histórico por slug |
| `app/api/indicadores/sync/mercado/route.ts` | Criar | Cron horário: Dólar, Euro, Ibovespa, Brent |
| `app/api/indicadores/sync/commodities/route.ts` | Criar | Cron diário: Selic, Minério, Aço, Alumínio, Cobre |
| `app/api/indicadores/sync/regional/route.ts` | Criar | Cron mensal: Exportações e Produção Industrial ES & MG |
| `components/indicadores/Sparkline.tsx` | Criar | Mini gráfico SVG inline (server-safe, sem lib) |
| `components/indicadores/IndicadorCard.tsx` | Criar | Card com valor, variação colorida, sparkline, badge de frequência |
| `components/indicadores/HistoricoChart.tsx` | Criar | Gráfico de linha interativo com Recharts (`"use client"`) |
| `components/indicadores/PeriodoSelector.tsx` | Criar | Seletor 7d/30d/90d/1a (`"use client"`) |
| `app/indicadores/page.tsx` | Criar | Página principal: 3 grupos de cards (Server Component, ISR 300s) |
| `app/indicadores/[slug]/page.tsx` | Criar | Página de detalhe: gráfico + tabela + contexto (Server Component, ISR 300s) |

---

## Task 1: Migration SQL + Seed Config

**Files:**
- Create: `supabase/migrations/008_indicadores.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- supabase/migrations/008_indicadores.sql

CREATE TABLE public.indicadores_snapshots (
  id           SERIAL      PRIMARY KEY,
  slug         TEXT        NOT NULL,
  value        NUMERIC     NOT NULL,
  variation    NUMERIC,
  raw_data     JSONB,
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ind_slug_time ON public.indicadores_snapshots(slug, captured_at DESC);

CREATE TABLE public.indicadores_config (
  slug         TEXT    PRIMARY KEY,
  name         TEXT    NOT NULL,
  group_name   TEXT    NOT NULL,
  unit         TEXT    NOT NULL,
  decimals     INT     NOT NULL DEFAULT 2,
  frequency    TEXT    NOT NULL,
  source_label TEXT    NOT NULL,
  source_url   TEXT,
  description  TEXT,
  active       BOOLEAN NOT NULL DEFAULT true
);

-- RLS: SELECT público, INSERT/UPDATE apenas service_role
ALTER TABLE public.indicadores_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.indicadores_config     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ind_snapshots_select" ON public.indicadores_snapshots FOR SELECT USING (true);
CREATE POLICY "ind_snapshots_insert" ON public.indicadores_snapshots FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "ind_config_select" ON public.indicadores_config FOR SELECT USING (true);
CREATE POLICY "ind_config_write"  ON public.indicadores_config FOR ALL USING (public.is_admin() OR auth.role() = 'service_role') WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

-- Seed: configuração de todos os indicadores
INSERT INTO public.indicadores_config (slug, name, group_name, unit, decimals, frequency, source_label, source_url, description) VALUES
('dolar',      'Dólar (USD/BRL)',              'Financeiros',           'R$',       2, 'horária',  'AwesomeAPI',    'https://docs.awesomeapi.com.br', 'O dólar é a principal referência para importação de matéria-prima e máquinas no setor metalmecânico. Alta do dólar encarece insumos importados como aço carbono, componentes eletrônicos e equipamentos CNC.'),
('euro',       'Euro (EUR/BRL)',               'Financeiros',           'R$',       2, 'horária',  'AwesomeAPI',    'https://docs.awesomeapi.com.br', 'O euro impacta importações de máquinas e tecnologia europeias, especialmente de fornecedores alemães, italianos e espanhóis, que dominam o mercado de equipamentos industriais de precisão.'),
('ibovespa',   'Ibovespa',                    'Financeiros',           'pts',      0, 'horária',  'brapi.dev',     'https://brapi.dev', 'O Ibovespa reflete o humor do mercado financeiro brasileiro e influencia o acesso a crédito e investimentos nas indústrias listadas. Empresas como Gerdau, Vale e Usiminas fazem parte do índice.'),
('selic',      'Selic (% a.a.)',              'Financeiros',           '% a.a.',   2, 'diária',   'Banco Central', 'https://www.bcb.gov.br', 'A taxa Selic é a referência para o custo do crédito industrial no Brasil. Juros altos encarecem financiamentos de expansão, compra de máquinas e capital de giro, impactando diretamente o setor metalmecânico.'),
('petroleo',   'Petróleo Brent (USD/bbl)',    'Commodities Industriais','USD/bbl',  2, 'horária',  'brapi.dev',     'https://brapi.dev', 'O petróleo Brent é insumo direto na produção de plásticos, lubrificantes e combustíveis usados no setor industrial. Também influencia o custo de frete e logística das cadeias de suprimentos.'),
('minerio',    'Minério de Ferro (USD/t)',    'Commodities Industriais','USD/t',    2, 'diária',   'brapi.dev',     'https://brapi.dev', 'O minério de ferro é a principal matéria-prima da produção de aço. Seu preço no mercado internacional impacta diretamente o custo do aço para a indústria metalmecânica brasileira, especialmente em MG onde Vale e Usiminas atuam.'),
('aco',        'Aço HRC (USD/t)',             'Commodities Industriais','USD/t',    2, 'diária',   'brapi.dev',     'https://brapi.dev', 'O aço laminado a quente (HRC) é o principal insumo da indústria metalmecânica. Oscilações no seu preço afetam margens de fabricantes de estruturas metálicas, autopeças, máquinas e equipamentos.'),
('aluminio',   'Alumínio (USD/t)',            'Commodities Industriais','USD/t',    2, 'diária',   'brapi.dev',     'https://brapi.dev', 'O alumínio é amplamente utilizado na fabricação de estruturas, embalagens industriais e componentes automotivos. ES e MG possuem capacidade instalada relevante de produção e transformação de alumínio.'),
('cobre',      'Cobre (USD/lb)',              'Commodities Industriais','USD/lb',   2, 'diária',   'brapi.dev',     'https://brapi.dev', 'O cobre é insumo essencial para motores elétricos, transformadores, cabos e sistemas de automação industrial. Seu preço sinaliza a demanda global por eletrificação e infraestrutura — tendência que impulsiona toda a cadeia metalmecânica.'),
('exportacoes','Exportações ES & MG (US$ mi)','Regional ES & MG',     'US$ mi',   1, 'mensal',   'MDIC Comex Stat','https://comexstat.mdic.gov.br', 'O volume de exportações industriais do ES e MG reflete a competitividade do setor. MG lidera com minério de ferro, aço e autopeças; ES exporta principalmente minério, celulose e produtos metalmecânicos via porto de Vitória.'),
('producao',   'Produção Industrial ES & MG', 'Regional ES & MG',     'Índice',   1, 'mensal',   'IBGE SIDRA',    'https://sidra.ibge.gov.br', 'O índice de produção industrial (PIM-PF) do ES e MG mede a variação do volume físico produzido pelas indústrias. É o principal termômetro da atividade industrial regional, com impacto direto no emprego e PIB dos estados.');
```

- [ ] **Step 2: Executar a migration no Supabase**

Cole o conteúdo do arquivo no SQL Editor do Supabase Dashboard e execute. Deve retornar sem erros.

- [ ] **Step 3: Verificar as tabelas criadas**

No SQL Editor do Supabase, execute:
```sql
SELECT slug, name, frequency FROM indicadores_config ORDER BY group_name, slug;
```
Esperado: 11 linhas com os slugs configurados.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/008_indicadores.sql
git commit -m "feat(db): tabelas indicadores_snapshots e indicadores_config"
```

---

## Task 2: Tipos TypeScript

**Files:**
- Modify: `types/database.ts`

- [ ] **Step 1: Adicionar os tipos das novas tabelas no final do objeto `Tables` em `types/database.ts`**

Abrir `types/database.ts` e antes do fechamento `};` do objeto `Tables`, adicionar:

```typescript
      indicadores_snapshots: {
        Row: { id: number; slug: string; value: number; variation: number | null; raw_data: Record<string, unknown> | null; captured_at: string };
        Insert: { slug: string; value: number; variation?: number | null; raw_data?: Record<string, unknown> | null; captured_at?: string };
        Update: { value?: number; variation?: number | null; raw_data?: Record<string, unknown> | null };
      };
      indicadores_config: {
        Row: { slug: string; name: string; group_name: string; unit: string; decimals: number; frequency: string; source_label: string; source_url: string | null; description: string | null; active: boolean };
        Insert: { slug: string; name: string; group_name: string; unit: string; decimals?: number; frequency: string; source_label: string; source_url?: string | null; description?: string | null; active?: boolean };
        Update: { name?: string; group_name?: string; unit?: string; decimals?: number; frequency?: string; source_label?: string; source_url?: string | null; description?: string | null; active?: boolean };
      };
```

- [ ] **Step 2: Verificar tipos com type-check**

```bash
npm run type-check
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add types/database.ts
git commit -m "feat(types): adiciona tipos indicadores_snapshots e indicadores_config"
```

---

## Task 3: Fetchers de APIs externas

**Files:**
- Create: `lib/indicadores/fetchers.ts`

- [ ] **Step 1: Criar o arquivo de fetchers**

```typescript
// lib/indicadores/fetchers.ts

export type IndicadorFetch = {
  slug: string;
  value: number;
  variation: number | null;
  raw_data: Record<string, unknown>;
};

// ─── AwesomeAPI: Dólar e Euro ───────────────────────────────────────────────
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

// ─── brapi.dev: Yahoo Finance tickers ──────────────────────────────────────
// Symbols: ^BVSP=Ibovespa, BZ=F=Brent, TIO=F=Minério, HRC=F=Aço, ALI=F=Alumínio, HG=F=Cobre
export async function fetchBrapi(
  symbols: string[]
): Promise<Map<string, { price: number; changePct: number; raw: Record<string, unknown> }>> {
  const query = symbols.join(',');
  const res = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(query)}`, {
    cache: 'no-store',
  });
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

// ─── Banco Central OLINDA: Selic (série 11) ────────────────────────────────
export async function fetchSelic(): Promise<IndicadorFetch> {
  const res = await fetch(
    'https://api.bcb.gov.br/dados/serie/bcdata.sgs.11/dados/ultimos/1?formato=json',
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`BCB error: ${res.status}`);
  const [data] = await res.json() as Array<{ data: string; valor: string }>;
  return {
    slug: 'selic',
    value: parseFloat(data.valor),
    variation: null,
    raw_data: data as unknown as Record<string, unknown>,
  };
}

// ─── MDIC Comex Stat: Exportações ES & MG ─────────────────────────────────
// Retorna US$ FOB em milhões do último mês disponível (ES=32, MG=31)
export async function fetchExportacoes(): Promise<IndicadorFetch> {
  const now = new Date();
  // MDIC publica dados com ~1 mês de atraso — busca o mês anterior
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
  const data = await res.json() as { data?: Array<{ metricFOB?: number }> };
  const totalUSD = (data.data ?? []).reduce((sum, row) => sum + (row.metricFOB ?? 0), 0);
  return {
    slug: 'exportacoes',
    value: Math.round((totalUSD / 1_000_000) * 10) / 10, // converte para US$ mi com 1 decimal
    variation: null,
    raw_data: data as unknown as Record<string, unknown>,
  };
}

// ─── IBGE SIDRA: Produção Industrial ES & MG ──────────────────────────────
// Tabela 3653 (PIM estadual), variável 3135 (índice base fixa), N3[32]=ES, N3[31]=MG
export async function fetchProducaoIndustrial(): Promise<IndicadorFetch> {
  const res = await fetch(
    'https://servicodados.ibge.gov.br/api/v3/agregados/3653/periodos/last/variaveis/3135?localidades=N3[32,31]',
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error(`IBGE error: ${res.status}`);
  const data = await res.json() as Array<{
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
      if (!isNaN(last)) { total += last; count++; }
    }
  } catch {}

  return {
    slug: 'producao',
    value: count > 0 ? Math.round((total / count) * 10) / 10 : 0,
    variation: null,
    raw_data: data as unknown as Record<string, unknown>,
  };
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run type-check
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/indicadores/fetchers.ts
git commit -m "feat(indicadores): fetchers para AwesomeAPI, brapi.dev, BCB, MDIC, IBGE"
```

---

## Task 4: Queries Supabase

**Files:**
- Create: `lib/indicadores/queries.ts`

- [ ] **Step 1: Criar o arquivo de queries**

```typescript
// lib/indicadores/queries.ts

import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

type Snapshot = Database['public']['Tables']['indicadores_snapshots']['Row'];
type Config = Database['public']['Tables']['indicadores_config']['Row'];

export type IndicadorComConfig = Config & {
  latest: Snapshot | null;
  sparkline: number[];
};

// Retorna todos os indicadores ativos com último snapshot e sparkline (30 pontos)
export async function getIndicadoresComDados(): Promise<IndicadorComConfig[]> {
  const supabase = await createClient();

  const { data: configs } = await supabase
    .from('indicadores_config')
    .select('*')
    .eq('active', true)
    .order('group_name')
    .order('slug');

  if (!configs?.length) return [];

  const slugs = configs.map((c) => c.slug);

  // Último snapshot de cada slug
  const { data: latestRows } = await supabase
    .from('indicadores_snapshots')
    .select('*')
    .in('slug', slugs)
    .order('captured_at', { ascending: false });

  const latestMap = new Map<string, Snapshot>();
  const sparklineMap = new Map<string, number[]>();

  for (const row of latestRows ?? []) {
    if (!latestMap.has(row.slug)) {
      latestMap.set(row.slug, row);
    }
    const arr = sparklineMap.get(row.slug) ?? [];
    if (arr.length < 30) {
      arr.push(row.value);
      sparklineMap.set(row.slug, arr);
    }
  }

  return configs.map((config) => ({
    ...config,
    latest: latestMap.get(config.slug) ?? null,
    sparkline: (sparklineMap.get(config.slug) ?? []).reverse(),
  }));
}

// Retorna histórico de um indicador para a página de detalhe
export async function getHistorico(
  slug: string,
  dias: number
): Promise<Snapshot[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('indicadores_snapshots')
    .select('*')
    .eq('slug', slug)
    .gte('captured_at', since)
    .order('captured_at', { ascending: true });

  return data ?? [];
}

// Retorna config + último snapshot de um slug específico
export async function getIndicadorBySlug(
  slug: string
): Promise<{ config: Config; latest: Snapshot | null } | null> {
  const supabase = await createClient();

  const { data: config } = await supabase
    .from('indicadores_config')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!config) return null;

  const { data: latest } = await supabase
    .from('indicadores_snapshots')
    .select('*')
    .eq('slug', slug)
    .order('captured_at', { ascending: false })
    .limit(1)
    .single();

  return { config, latest: latest ?? null };
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run type-check
```
Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add lib/indicadores/queries.ts
git commit -m "feat(indicadores): queries Supabase para snapshots e config"
```

---

## Task 5: Cron Mercado (horário)

**Files:**
- Create: `app/api/indicadores/sync/mercado/route.ts`

- [ ] **Step 1: Criar a rota**

```typescript
// app/api/indicadores/sync/mercado/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchCambio, fetchBrapi } from '@/lib/indicadores/fetchers';
import type { IndicadorFetch } from '@/lib/indicadores/fetchers';

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

  // Câmbio: Dólar e Euro
  try {
    const cambio = await fetchCambio();
    for (const item of cambio) {
      await insertSnapshot(supabase, item);
      updated.push(item.slug);
    }
  } catch (e) {
    errors.push(`cambio: ${e instanceof Error ? e.message : String(e)}`);
  }

  // brapi.dev: Ibovespa e Brent
  try {
    const brapiMap = await fetchBrapi(['^BVSP', 'BZ=F']);
    const slugMap: Record<string, string> = { '^BVSP': 'ibovespa', 'BZ=F': 'petroleo' };
    for (const [symbol, slugName] of Object.entries(slugMap)) {
      const result = brapiMap.get(symbol);
      if (result) {
        await insertSnapshot(supabase, {
          slug: slugName,
          value: result.price,
          variation: result.changePct,
          raw_data: result.raw,
        });
        updated.push(slugName);
      }
    }
  } catch (e) {
    errors.push(`brapi: ${e instanceof Error ? e.message : String(e)}`);
  }

  return NextResponse.json({ ok: true, updated, errors });
}

async function insertSnapshot(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  item: IndicadorFetch
) {
  await supabase.from('indicadores_snapshots').insert({
    slug: item.slug,
    value: item.value,
    variation: item.variation,
    raw_data: item.raw_data,
  });
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run type-check
```

- [ ] **Step 3: Testar a rota localmente**

```bash
# Inicie o servidor: npm run dev
# Em outro terminal:
curl -X POST "http://localhost:3005/api/indicadores/sync/mercado?secret=SEU_CRON_SECRET"
```
Esperado: `{"ok":true,"updated":["dolar","euro","ibovespa","petroleo"],"errors":[]}`

- [ ] **Step 4: Commit**

```bash
git add app/api/indicadores/sync/mercado/route.ts
git commit -m "feat(indicadores): cron horário mercado (câmbio, ibovespa, brent)"
```

---

## Task 6: Cron Commodities (diário)

**Files:**
- Create: `app/api/indicadores/sync/commodities/route.ts`

- [ ] **Step 1: Criar a rota**

```typescript
// app/api/indicadores/sync/commodities/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchSelic, fetchBrapi } from '@/lib/indicadores/fetchers';
import type { IndicadorFetch } from '@/lib/indicadores/fetchers';

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

  // Selic
  try {
    const selic = await fetchSelic();
    await insertSnapshot(supabase, selic);
    updated.push('selic');
  } catch (e) {
    errors.push(`selic: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Commodities via brapi.dev
  // TIO=F=Minério de Ferro, HRC=F=Aço, ALI=F=Alumínio, HG=F=Cobre
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
        await insertSnapshot(supabase, {
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

async function insertSnapshot(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  item: IndicadorFetch
) {
  await supabase.from('indicadores_snapshots').insert({
    slug: item.slug,
    value: item.value,
    variation: item.variation,
    raw_data: item.raw_data,
  });
}
```

- [ ] **Step 2: Testar localmente**

```bash
curl -X POST "http://localhost:3005/api/indicadores/sync/commodities?secret=SEU_CRON_SECRET"
```
Esperado: `{"ok":true,"updated":["selic","minerio","aco","aluminio","cobre"],"errors":[]}`

- [ ] **Step 3: Commit**

```bash
git add app/api/indicadores/sync/commodities/route.ts
git commit -m "feat(indicadores): cron diário commodities (selic, minério, aço, alumínio, cobre)"
```

---

## Task 7: Cron Regional (mensal)

**Files:**
- Create: `app/api/indicadores/sync/regional/route.ts`

- [ ] **Step 1: Criar a rota**

```typescript
// app/api/indicadores/sync/regional/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchExportacoes, fetchProducaoIndustrial } from '@/lib/indicadores/fetchers';
import type { IndicadorFetch } from '@/lib/indicadores/fetchers';

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

  // Exportações ES & MG (MDIC Comex Stat)
  try {
    const exp = await fetchExportacoes();
    await insertSnapshot(supabase, exp);
    updated.push('exportacoes');
  } catch (e) {
    errors.push(`exportacoes: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Produção Industrial ES & MG (IBGE SIDRA)
  try {
    const prod = await fetchProducaoIndustrial();
    await insertSnapshot(supabase, prod);
    updated.push('producao');
  } catch (e) {
    errors.push(`producao: ${e instanceof Error ? e.message : String(e)}`);
  }

  return NextResponse.json({ ok: true, updated, errors });
}

async function insertSnapshot(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  item: IndicadorFetch
) {
  await supabase.from('indicadores_snapshots').insert({
    slug: item.slug,
    value: item.value,
    variation: item.variation,
    raw_data: item.raw_data,
  });
}
```

- [ ] **Step 2: Testar localmente**

```bash
curl -X POST "http://localhost:3005/api/indicadores/sync/regional?secret=SEU_CRON_SECRET"
```
Esperado: `{"ok":true,"updated":["exportacoes","producao"],"errors":[]}`

> **Nota:** Se erros aparecerem em `exportacoes` ou `producao`, verifique o payload da API no campo `raw_data` do snapshot inserido no Supabase para diagnosticar o formato de resposta.

- [ ] **Step 3: Commit**

```bash
git add app/api/indicadores/sync/regional/route.ts
git commit -m "feat(indicadores): cron mensal regional (exportações e produção ES & MG)"
```

---

## Task 8: Componente Sparkline (SVG inline)

**Files:**
- Create: `components/indicadores/Sparkline.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// components/indicadores/Sparkline.tsx

type SparklineProps = {
  data: number[];
  positive: boolean;
  width?: number;
  height?: number;
};

export function Sparkline({ data, positive, width = 80, height = 28 }: SparklineProps) {
  if (data.length < 2) return <div style={{ width, height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const color = positive ? '#16a34a' : '#dc2626';
  const fillId = `fill-${positive ? 'pos' : 'neg'}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add components/indicadores/Sparkline.tsx
git commit -m "feat(indicadores): componente Sparkline SVG inline"
```

---

## Task 9: Componente IndicadorCard

**Files:**
- Create: `components/indicadores/IndicadorCard.tsx`

- [ ] **Step 1: Criar o componente**

```tsx
// components/indicadores/IndicadorCard.tsx

import Link from 'next/link';
import { Sparkline } from './Sparkline';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type IndicadorCardProps = {
  slug: string;
  name: string;
  unit: string;
  decimals: number;
  frequency: string;
  value: number | null;
  variation: number | null;
  sparkline: number[];
  capturedAt: string | null;
};

function formatValue(value: number, unit: string, decimals: number): string {
  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (unit === 'R$' || unit === 'USD/bbl' || unit === 'USD/t' || unit === 'USD/lb' || unit === 'US$ mi') {
    return unit.startsWith('R$') ? `R$ ${formatted}` : `${formatted} ${unit.replace('R$ ', '')}`;
  }
  if (unit === '% a.a.') return `${formatted}%`;
  if (unit === 'pts') return formatted;
  return `${formatted} ${unit}`;
}

function cleanUnit(unit: string): string {
  if (unit === 'R$') return 'R$';
  return unit;
}

export function IndicadorCard({
  slug,
  name,
  unit,
  decimals,
  frequency,
  value,
  variation,
  sparkline,
  capturedAt,
}: IndicadorCardProps) {
  const positive = (variation ?? 0) >= 0;
  const hasData = value !== null;

  return (
    <Link
      href={`/indicadores/${slug}`}
      className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow group flex flex-col gap-2"
    >
      {/* Nome */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-tight">
          {name}
        </span>
        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
          {frequency}
        </span>
      </div>

      {/* Valor */}
      {hasData ? (
        <div className="flex items-end justify-between gap-2">
          <div>
            <div className="text-xl font-black text-gray-900 group-hover:text-[#1A2B4A] transition-colors leading-tight">
              {formatValue(value!, cleanUnit(unit), decimals)}
            </div>
            {variation !== null && (
              <div
                className={`text-sm font-semibold mt-0.5 ${
                  positive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {positive ? '▲' : '▼'} {Math.abs(variation).toFixed(2)}%
              </div>
            )}
          </div>
          <Sparkline data={sparkline} positive={positive} />
        </div>
      ) : (
        <div className="text-sm text-gray-400 italic py-2">Aguardando dados...</div>
      )}

      {/* Última atualização */}
      {capturedAt && (
        <div className="text-[10px] text-gray-400 mt-auto">
          Atualizado{' '}
          {formatDistanceToNow(new Date(capturedAt), { addSuffix: true, locale: ptBR })}
        </div>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: Verificar tipos**

```bash
npm run type-check
```

- [ ] **Step 3: Commit**

```bash
git add components/indicadores/IndicadorCard.tsx
git commit -m "feat(indicadores): componente IndicadorCard com sparkline e badge de frequência"
```

---

## Task 10: Página Principal /indicadores

**Files:**
- Create: `app/indicadores/page.tsx`

- [ ] **Step 1: Criar a página**

```tsx
// app/indicadores/page.tsx

import type { Metadata } from 'next';
import { getIndicadoresComDados } from '@/lib/indicadores/queries';
import { IndicadorCard } from '@/components/indicadores/IndicadorCard';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Indicadores Econômicos',
  description:
    'Acompanhe os principais indicadores econômicos e de commodities para o setor metalmecânico: Dólar, Ibovespa, Selic, aço, cobre, alumínio e muito mais.',
};

const GRUPOS_ORDER = ['Financeiros', 'Commodities Industriais', 'Regional ES & MG'];

export default async function IndicadoresPage() {
  const indicadores = await getIndicadoresComDados();

  const grupos = GRUPOS_ORDER.map((grupo) => ({
    nome: grupo,
    items: indicadores.filter((i) => i.group_name === grupo),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1 h-7 bg-[#C9A84C] rounded" />
          <h1 className="text-2xl font-black text-[#1A2B4A] uppercase tracking-wide">
            Indicadores
          </h1>
        </div>
        <p className="text-gray-500 text-sm ml-4">
          Dados econômicos e de commodities relevantes para o setor metalmecânico do ES e MG.
          Valores atualizados automaticamente via fontes públicas.
        </p>
      </div>

      {/* Grupos */}
      <div className="space-y-10">
        {grupos.map((grupo) => (
          <section key={grupo.nome}>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                {grupo.nome}
              </h2>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {grupo.items.map((ind) => (
                <IndicadorCard
                  key={ind.slug}
                  slug={ind.slug}
                  name={ind.name}
                  unit={ind.unit}
                  decimals={ind.decimals}
                  frequency={ind.frequency}
                  value={ind.latest?.value ?? null}
                  variation={ind.latest?.variation ?? null}
                  sparkline={ind.sparkline}
                  capturedAt={ind.latest?.captured_at ?? null}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Rodapé informativo */}
      <div className="mt-12 p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-400">
        <strong className="text-gray-500">Fontes:</strong> AwesomeAPI (câmbio), brapi.dev via Yahoo
        Finance (ações e commodities), Banco Central do Brasil (Selic), MDIC Comex Stat
        (exportações), IBGE SIDRA (produção industrial). Dados com fins informativos. Não
        constituem recomendação de investimento.
      </div>
    </div>
  );
}
```

> **Nota:** O arquivo usa `GRUPOS_Order` — corrija para `GRUPOS_ORDER` (mesmas maiúsculas usadas na declaração acima). Está assim por motivo de formatação do plano — no arquivo real use o mesmo nome.

- [ ] **Step 2: Verificar tipos e build**

```bash
npm run type-check
```

- [ ] **Step 4: Testar no browser**

```bash
npm run dev
```
Abrir `http://localhost:3005/indicadores`. Deve aparecer a página com os grupos. Cards sem dados mostram "Aguardando dados..." (normal antes de rodar o cron).

- [ ] **Step 5: Commit**

```bash
git add app/indicadores/page.tsx
git commit -m "feat(indicadores): página principal com grupos e cards"
```

---

## Task 11: Instalar Recharts + Componentes de Detalhe

**Files:**
- Create: `components/indicadores/HistoricoChart.tsx`
- Create: `components/indicadores/PeriodoSelector.tsx`

- [ ] **Step 1: Instalar recharts**

```bash
npm install recharts
```

- [ ] **Step 2: Criar PeriodoSelector**

```tsx
// components/indicadores/PeriodoSelector.tsx
'use client';

type Periodo = '7d' | '30d' | '90d' | '1a';

type PeriodoSelectorProps = {
  value: Periodo;
  onChange: (p: Periodo) => void;
};

const OPCOES: { label: string; value: Periodo }[] = [
  { label: '7 dias', value: '7d' },
  { label: '30 dias', value: '30d' },
  { label: '90 dias', value: '90d' },
  { label: '1 ano', value: '1a' },
];

export function PeriodoSelector({ value, onChange }: PeriodoSelectorProps) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {OPCOES.map((op) => (
        <button
          key={op.value}
          onClick={() => onChange(op.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            value === op.value
              ? 'bg-white text-[#1A2B4A] shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {op.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Criar HistoricoChart**

```tsx
// components/indicadores/HistoricoChart.tsx
'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PeriodoSelector } from './PeriodoSelector';

type Periodo = '7d' | '30d' | '90d' | '1a';

type Snapshot = {
  value: number;
  captured_at: string;
};

type HistoricoChartProps = {
  data: Record<Periodo, Snapshot[]>;
  unit: string;
  decimals: number;
  positive: boolean;
};

const DIAS: Record<Periodo, number> = { '7d': 7, '30d': 30, '90d': 90, '1a': 365 };

export function HistoricoChart({ data, unit, decimals, positive }: HistoricoChartProps) {
  const [periodo, setPeriodo] = useState<Periodo>('30d');
  const snapshots = data[periodo];

  const chartData = snapshots.map((s) => ({
    date: format(new Date(s.captured_at), 'dd/MM', { locale: ptBR }),
    value: s.value,
  }));

  const color = positive ? '#16a34a' : '#1A2B4A';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {snapshots.length} pontos nos últimos {DIAS[periodo]} dias
        </span>
        <PeriodoSelector value={periodo} onChange={setPeriodo} />
      </div>

      {snapshots.length < 2 ? (
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-400">
          Dados insuficientes para o período selecionado
        </div>
      ) : (
        <div className="h-64 bg-white rounded-xl border border-gray-100 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) =>
                  v.toLocaleString('pt-BR', {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals,
                  })
                }
                width={60}
              />
              <Tooltip
                formatter={(v: number) => [
                  `${v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${unit}`,
                  'Valor',
                ]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: color }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Verificar tipos**

```bash
npm run type-check
```

- [ ] **Step 5: Commit**

```bash
git add components/indicadores/HistoricoChart.tsx components/indicadores/PeriodoSelector.tsx
git commit -m "feat(indicadores): HistoricoChart (recharts) e PeriodoSelector"
```

---

## Task 12: Página de Detalhe /indicadores/[slug]

**Files:**
- Create: `app/indicadores/[slug]/page.tsx`

- [ ] **Step 1: Criar a página de detalhe**

```tsx
// app/indicadores/[slug]/page.tsx

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getIndicadorBySlug, getHistorico } from '@/lib/indicadores/queries';
import { HistoricoChart } from '@/components/indicadores/HistoricoChart';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getIndicadorBySlug(slug);
  if (!result) return {};
  return {
    title: result.config.name,
    description: result.config.description ?? undefined,
  };
}

export default async function IndicadorDetalhe({ params }: Props) {
  const { slug } = await params;
  const result = await getIndicadorBySlug(slug);
  if (!result) notFound();

  const { config, latest } = result;

  // Busca histórico para todos os períodos
  const [h7, h30, h90, h365] = await Promise.all([
    getHistorico(slug, 7),
    getHistorico(slug, 30),
    getHistorico(slug, 90),
    getHistorico(slug, 365),
  ]);

  const historicoData = { '7d': h7, '30d': h30, '90d': h90, '1a': h365 };
  const positive = (latest?.variation ?? 0) >= 0;

  const valorFormatado = latest
    ? latest.value.toLocaleString('pt-BR', {
        minimumFractionDigits: config.decimals,
        maximumFractionDigits: config.decimals,
      })
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-gray-400 mb-6">
        <Link href="/indicadores" className="hover:text-[#1A2B4A] transition-colors">
          Indicadores
        </Link>
        <span>/</span>
        <span className="text-gray-700">{config.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-6">

          {/* Header do indicador */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h1 className="text-xl font-black text-[#1A2B4A]">{config.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    Atualização {config.frequency}
                  </span>
                  {config.source_url ? (
                    <a
                      href={config.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#C9A84C] hover:underline"
                    >
                      {config.source_label}
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">{config.source_label}</span>
                  )}
                </div>
              </div>

              {latest && (
                <div className="text-right flex-shrink-0">
                  <div className="text-3xl font-black text-gray-900">
                    {valorFormatado} <span className="text-lg font-medium text-gray-400">{config.unit}</span>
                  </div>
                  {latest.variation !== null && (
                    <div className={`text-base font-bold ${positive ? 'text-green-600' : 'text-red-600'}`}>
                      {positive ? '▲' : '▼'} {Math.abs(latest.variation).toFixed(2)}%
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    {format(new Date(latest.captured_at), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </div>
                </div>
              )}
            </div>

            {!latest && (
              <div className="text-sm text-gray-400 italic">Aguardando primeira sincronização...</div>
            )}
          </div>

          {/* Gráfico histórico */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
              Histórico
            </h2>
            <HistoricoChart
              data={historicoData}
              unit={config.unit}
              decimals={config.decimals}
              positive={positive}
            />
          </div>

          {/* Tabela histórica (últimos 20 snapshots) */}
          {h30.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  Dados Recentes
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Valor</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Variação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[...h30].reverse().slice(0, 20).map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3 text-gray-600">
                          {format(new Date(s.captured_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </td>
                        <td className="px-6 py-3 text-right font-semibold text-gray-900">
                          {s.value.toLocaleString('pt-BR', {
                            minimumFractionDigits: config.decimals,
                            maximumFractionDigits: config.decimals,
                          })} {config.unit}
                        </td>
                        <td className="px-6 py-3 text-right">
                          {s.variation !== null ? (
                            <span className={s.variation >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {s.variation >= 0 ? '▲' : '▼'} {Math.abs(s.variation).toFixed(2)}%
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {/* Contexto do indicador */}
          {config.description && (
            <div className="bg-[#1A2B4A] rounded-xl p-5 text-white">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 bg-[#C9A84C] rounded" />
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  Por que acompanhar?
                </h3>
              </div>
              <p className="text-blue-100 text-sm leading-relaxed">{config.description}</p>
            </div>
          )}

          {/* Informações técnicas */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
              Informações
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Unidade</dt>
                <dd className="font-medium text-gray-900">{config.unit}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Atualização</dt>
                <dd className="font-medium text-gray-900 capitalize">{config.frequency}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Fonte</dt>
                <dd className="font-medium text-gray-900">{config.source_label}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Total de registros</dt>
                <dd className="font-medium text-gray-900">{h365.length}</dd>
              </div>
            </dl>
          </div>

          {/* Voltar */}
          <Link
            href="/indicadores"
            className="flex items-center gap-2 text-sm text-[#1A2B4A] font-medium hover:underline"
          >
            ← Todos os indicadores
          </Link>
        </aside>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos e build**

```bash
npm run type-check
```

- [ ] **Step 3: Testar no browser**

Com o dev server rodando, acesse `http://localhost:3005/indicadores/dolar`. Deve renderizar a página de detalhe. Se não houver dados ainda, o card mostra "Aguardando primeira sincronização..." — comportamento correto.

- [ ] **Step 4: Commit**

```bash
git add app/indicadores/[slug]/page.tsx
git commit -m "feat(indicadores): páginas de detalhe com gráfico histórico e tabela"
```

---

## Task 13: Configurar cron-job.org

- [ ] **Step 1: Garantir que `CRON_SECRET` está definida**

Verificar se a variável já existe (usada pelo cron de notícias):
```bash
# No Supabase ou verificando localmente no .env.local
# Se não existir, gere um valor seguro:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

- [ ] **Step 2: Configurar os 3 jobs no cron-job.org**

Acesse https://cron-job.org e crie 3 jobs:

| Nome | URL | Método | Horário |
|---|---|---|---|
| `portal-indicadores-mercado` | `https://[SEU-DOMINIO]/api/indicadores/sync/mercado?secret=[CRON_SECRET]` | POST | A cada hora (0 * * * *) |
| `portal-indicadores-commodities` | `https://[SEU-DOMINIO]/api/indicadores/sync/commodities?secret=[CRON_SECRET]` | POST | Diário 8h BRT (11 * * * *) |
| `portal-indicadores-regional` | `https://[SEU-DOMINIO]/api/indicadores/sync/regional?secret=[CRON_SECRET]` | POST | Mensal dia 5 8h (0 11 5 * *) |

> Substitua `[SEU-DOMINIO]` pela URL de produção no Vercel e `[CRON_SECRET]` pelo valor da variável.

- [ ] **Step 3: Fazer deploy no Vercel**

```bash
git push origin main
```

- [ ] **Step 4: Testar os crons manualmente no cron-job.org**

Após deploy, use o botão "Run now" para cada job no painel do cron-job.org. Verifique no Supabase:
```sql
SELECT slug, value, variation, captured_at
FROM indicadores_snapshots
ORDER BY captured_at DESC
LIMIT 20;
```
Deve retornar linhas para os slugs sincronizados.

- [ ] **Step 5: Verificar a página de produção**

Acesse `https://[SEU-DOMINIO]/indicadores` — deve mostrar os cards com dados reais.

---

## Verificação Final

- [ ] Todos os 11 indicadores aparecem na página `/indicadores`
- [ ] Cards mostram valor, variação colorida, sparkline e badge de frequência
- [ ] Cada card leva para `/indicadores/[slug]` com gráfico e tabela
- [ ] Crons respondem 200 com `{ ok: true }` quando chamados com o secret correto
- [ ] Crons retornam 401 sem o secret
- [ ] Snapshots aparecem no Supabase após rodar os crons
- [ ] Build de produção sem erros: `npm run build`
