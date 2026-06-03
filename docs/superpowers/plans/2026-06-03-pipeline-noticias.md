# Pipeline Automático de Notícias — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir um pipeline que coleta notícias de 4 APIs + feeds RSS, filtra por relevância com Gemini, deduplica, enriquece com imagem e publica automaticamente na tabela `posts` a cada 3 horas via cron Vercel.

**Architecture:** Tabela `posts` existente + 3 colunas novas (`fonte_url`, `fonte_nome`, `is_auto`). Pipeline em 7 módulos isolados em `lib/noticias/`, orquestrados por uma route handler em `app/api/cron/buscar-noticias/route.ts`. Publicação imediata, sem fila de moderação.

**Tech Stack:** Next.js 16 App Router, Supabase service_role, Gemini Flash (`@google/generative-ai`), fetch nativo para RSS/APIs.

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `supabase/migrations/002_pipeline_columns.sql` | Criar | Adiciona fonte_url, fonte_nome, is_auto à posts |
| `types/database.ts` | Modificar | Adiciona 3 campos novos à interface posts |
| `lib/noticias/types.ts` | Criar | Interfaces FeedItem, ItemComScore, ResultadoPipeline |
| `lib/noticias/utils.ts` | Criar | safeRun, processarComConcorrencia, slugify, normT |
| `lib/noticias/feed-fetcher.ts` | Criar | fetchFeeds() — coleta RSS + 4 APIs |
| `lib/noticias/relevance-filter.ts` | Criar | scoreRapido() + filtrarRelevanciaIA() via Gemini |
| `lib/noticias/ai-rewriter.ts` | Criar | reescreverComIA() via Gemini |
| `lib/noticias/image-sourcer.ts` | Criar | resolverImagem() com fallback hierarchy |
| `lib/noticias/publisher.ts` | Criar | buscarExistentes(), ehDuplicata(), publicarNoticia() |
| `app/api/cron/buscar-noticias/route.ts` | Criar | Orquestrador do pipeline completo |
| `vercel.json` | Criar | Cron schedule 0 */3 * * * |

---

## Task 1: Instalar dependência + Migration SQL

**Files:**
- Create: `supabase/migrations/002_pipeline_columns.sql`
- Modify: `types/database.ts`

- [ ] **Step 1: Instalar `@google/generative-ai`**

```powershell
npm install @google/generative-ai
```

Expected output: `added 1 package` (ou similar, sem erros)

- [ ] **Step 2: Criar migration SQL**

Criar `supabase/migrations/002_pipeline_columns.sql`:

```sql
-- Pipeline automático de notícias: colunas de rastreamento de fonte
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS fonte_url  TEXT,
  ADD COLUMN IF NOT EXISTS fonte_nome TEXT,
  ADD COLUMN IF NOT EXISTS is_auto    BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_posts_fonte_url ON public.posts(fonte_url)
  WHERE fonte_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_is_auto ON public.posts(is_auto)
  WHERE is_auto = true;
```

- [ ] **Step 3: Aplicar migration no Supabase**

No painel do Supabase → SQL Editor → colar e executar o conteúdo do arquivo acima.
Verificar que não há erros e que a tabela `posts` agora tem as colunas `fonte_url`, `fonte_nome`, `is_auto`.

- [ ] **Step 4: Atualizar `types/database.ts`**

Substituir a interface `posts` para incluir os 3 novos campos:

```ts
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; email: string | null; name: string | null; cnpj: string | null; role: "admin" | "user"; created_at: string };
        Insert: { id: string; email?: string | null; name?: string | null; cnpj?: string | null; role?: "admin" | "user" };
        Update: { email?: string | null; name?: string | null; cnpj?: string | null; role?: "admin" | "user" };
      };
      posts: {
        Row: { id: number; slug: string; title: string; content: string | null; excerpt: string | null; featured_image: string | null; category: string | null; region: string | null; author_id: string | null; published_at: string | null; is_exclusive: boolean; created_at: string; fonte_url: string | null; fonte_nome: string | null; is_auto: boolean };
        Insert: { slug: string; title: string; content?: string | null; excerpt?: string | null; featured_image?: string | null; category?: string | null; region?: string | null; author_id?: string | null; published_at?: string | null; is_exclusive?: boolean; fonte_url?: string | null; fonte_nome?: string | null; is_auto?: boolean };
        Update: { slug?: string; title?: string; content?: string | null; excerpt?: string | null; featured_image?: string | null; category?: string | null; region?: string | null; published_at?: string | null; is_exclusive?: boolean; fonte_url?: string | null; fonte_nome?: string | null; is_auto?: boolean };
      };
      classifieds: {
        Row: { id: number; user_id: string; title: string; description: string | null; price: number | null; photos: string[] | null; city: string | null; state: string | null; category: string | null; status: "pending" | "active" | "expired" | "paid"; expires_at: string | null; payment_intent_id: string | null; created_at: string };
        Insert: { user_id: string; title: string; description?: string | null; price?: number | null; photos?: string[] | null; city?: string | null; state?: string | null; category?: string | null; status?: "pending" | "active" | "expired" | "paid"; expires_at?: string | null; payment_intent_id?: string | null };
        Update: { title?: string; description?: string | null; price?: number | null; photos?: string[] | null; city?: string | null; state?: string | null; category?: string | null; status?: "pending" | "active" | "expired" | "paid"; expires_at?: string | null; payment_intent_id?: string | null };
      };
      subscriptions: {
        Row: { id: string; user_id: string; status: "active" | "canceled" | "past_due" | "trialing"; plan: "monthly" | "yearly"; current_period_end: string; created_at: string };
        Insert: { id: string; user_id: string; status: "active" | "canceled" | "past_due" | "trialing"; plan: "monthly" | "yearly"; current_period_end: string };
        Update: { status?: "active" | "canceled" | "past_due" | "trialing"; plan?: "monthly" | "yearly"; current_period_end?: string };
      };
      ads: {
        Row: { id: number; name: string | null; image_url: string | null; link: string | null; position: "top" | "sidebar" | "between" | "footer" | null; start_date: string | null; end_date: string | null; impressions: number; clicks: number };
        Insert: { name?: string | null; image_url?: string | null; link?: string | null; position?: "top" | "sidebar" | "between" | "footer" | null; start_date?: string | null; end_date?: string | null };
        Update: { name?: string | null; image_url?: string | null; link?: string | null; position?: "top" | "sidebar" | "between" | "footer" | null; start_date?: string | null; end_date?: string | null; impressions?: number; clicks?: number };
      };
      subscribers: {
        Row: { email: string; created_at: string };
        Insert: { email: string };
        Update: never;
      };
    };
  };
};
```

- [ ] **Step 5: Verificar TypeScript**

```powershell
npm run type-check
```

Expected: sem erros relacionados a `fonte_url`, `fonte_nome`, `is_auto`.

- [ ] **Step 6: Commit**

```powershell
git add supabase/migrations/002_pipeline_columns.sql types/database.ts package.json package-lock.json
git commit -m "feat: migration pipeline + tipos + instalar generative-ai"
```

---

## Task 2: Tipos e Utilitários Base

**Files:**
- Create: `lib/noticias/types.ts`
- Create: `lib/noticias/utils.ts`

- [ ] **Step 1: Criar `lib/noticias/types.ts`**

```ts
export type TipoFonte = 'api' | 'rss-geral' | 'rss-dedicado';

export type FeedItem = {
  titulo: string;
  url: string;
  conteudo: string;
  publicadoEm: Date;
  imagemUrl?: string;
  fonteNome: string;
  tipoFonte: TipoFonte;
};

export type ItemComScore = FeedItem & { score: number };

export type ItemProcessado = FeedItem & {
  tituloFinal: string;
  resumoFinal: string;
  categoria: string;
  regiao: string;
  imagemFinal: string | null;
};

export type ResultadoPipeline = {
  inseridas: number;
  duplicadas: number;
  irrelevantes: number;
  erros: number;
  abortado: boolean;
  feedStats: Record<string, number>;
};
```

- [ ] **Step 2: Criar `lib/noticias/utils.ts`**

```ts
export async function safeRun<T>(
  fn: () => Promise<T>,
  opts: {
    tentativas?: number;
    delayBase?: number;
    timeout?: number;
    fallback?: T;
  } = {}
): Promise<T> {
  const { tentativas = 3, delayBase = 500, timeout = 15000 } = opts;

  for (let i = 0; i < tentativas; i++) {
    try {
      return await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('safeRun timeout')), timeout)
        ),
      ]);
    } catch {
      if (i === tentativas - 1) {
        if ('fallback' in opts) return opts.fallback as T;
        throw new Error(`safeRun falhou após ${tentativas} tentativas`);
      }
      await new Promise(r => setTimeout(r, delayBase * (i + 1)));
    }
  }
  // unreachable
  throw new Error('safeRun: unreachable');
}

export async function processarComConcorrencia<T>(
  itens: T[],
  fn: (item: T) => Promise<void>,
  concorrencia = 3
): Promise<void> {
  const queue = [...itens];
  const workers = Array.from(
    { length: Math.min(concorrencia, queue.length || 1) },
    async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item !== undefined) await fn(item).catch(() => {});
      }
    }
  );
  await Promise.all(workers);
}

export function slugifyTitulo(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

export function normT(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}
```

- [ ] **Step 3: Verificar TypeScript**

```powershell
npm run type-check
```

Expected: sem erros em `lib/noticias/`.

- [ ] **Step 4: Commit**

```powershell
git add lib/noticias/types.ts lib/noticias/utils.ts
git commit -m "feat(pipeline): types e utils base"
```

---

## Task 3: Coleta de Feeds (`feed-fetcher.ts`)

**Files:**
- Create: `lib/noticias/feed-fetcher.ts`

- [ ] **Step 1: Criar `lib/noticias/feed-fetcher.ts`**

```ts
import type { FeedItem, TipoFonte } from './types';
import { safeRun } from './utils';

// ─── Termos de busca para APIs ────────────────────────────────────────────────
const TERMOS = [
  'metalmecânica Brasil',
  'siderurgia Brasil',
  'metalurgia mercado',
  'aço Brasil',
  'automação industrial Brasil',
  'ABIMAQ',
  'Usiminas',
  'Vallourec',
  'CSN siderurgia',
  'indústria metal mecânica',
];

// ─── Feeds RSS ────────────────────────────────────────────────────────────────
const FEEDS_GERAL: { url: string; nome: string }[] = [
  { url: 'https://agenciabrasil.ebc.com.br/rss/economia/feed.xml', nome: 'Agência Brasil' },
  { url: 'https://exame.com/feed/', nome: 'Exame' },
  { url: 'https://www.infomoney.com.br/feed/', nome: 'InfoMoney' },
  { url: 'https://valor.globo.com/rss/industria', nome: 'Valor Econômico' },
  { url: 'https://www.em.com.br/rss/economia/rss.xml', nome: 'Estado de Minas' },
  { url: 'https://www.agazeta.com.br/rss/economia', nome: 'A Gazeta' },
  { url: 'https://www.folhavitoria.com.br/rss.xml', nome: 'Folha Vitória' },
];

const FEEDS_DEDICADO: { url: string; nome: string }[] = [
  { url: 'https://www.aneel.gov.br/rss', nome: 'ANEEL' },
  { url: 'https://www.gov.br/anp/pt-br/rss.xml', nome: 'ANP' },
  { url: 'https://www.ibram.org.br/rss', nome: 'IBRAM' },
  { url: 'https://www.iba.org.br/feed/', nome: 'IBÁ' },
];

// ─── Parsing RSS ──────────────────────────────────────────────────────────────
function extrairTexto(tag: string, xml: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
}

function extrairLink(xml: string): string {
  const m =
    xml.match(/<link[^>]*>(?:<!\[CDATA\[)?(https?[^<\]]+)(?:\]\]>)?<\/link>/i) ||
    xml.match(/<guid[^>]*>(https?[^<]+)<\/guid>/i);
  return m ? m[1].trim() : '';
}

function extrairPubDate(xml: string): Date | null {
  const patterns = [
    /<pubDate>([^<]+)<\/pubDate>/i,
    /<dc:date>([^<]+)<\/dc:date>/i,
    /<updated>([^<]+)<\/updated>/i,
    /<published>([^<]+)<\/published>/i,
  ];
  for (const p of patterns) {
    const m = xml.match(p);
    if (m) {
      const s = m[1].replace(/\bBRST\b/, '-0200').replace(/\bBRT\b/, '-0300').trim();
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function extrairImagemRSS(xml: string): string | undefined {
  const patterns = [
    /media:content[^>]+url="([^"]+)"/i,
    /media:thumbnail[^>]+url="([^"]+)"/i,
    /<enclosure[^>]+url="([^"]+)"[^>]+type="image/i,
    /<enclosure[^>]+type="image[^>]+url="([^"]+)"/i,
  ];
  for (const p of patterns) {
    const m = xml.match(p);
    if (m) return m[1];
  }
  return undefined;
}

function parsearItems(xml: string, nome: string, tipoFonte: TipoFonte): FeedItem[] {
  const items: FeedItem[] = [];
  const blocos = xml.split(/<item[\s>]|<entry[\s>]/i).slice(1);
  for (const bloco of blocos) {
    const titulo = extrairTexto('title', bloco);
    const url = extrairLink(bloco);
    const conteudo = extrairTexto('description', bloco) || extrairTexto('summary', bloco);
    const publicadoEm = extrairPubDate(bloco);
    const imagemUrl = extrairImagemRSS(bloco);
    if (!titulo || !url || !publicadoEm) continue;
    items.push({ titulo, url, conteudo, publicadoEm, imagemUrl, fonteNome: nome, tipoFonte });
  }
  return items;
}

async function fetchRSSFeed(feed: { url: string; nome: string }, tipoFonte: TipoFonte): Promise<FeedItem[]> {
  return safeRun(
    async () => {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortalMetalmecanica/1.0)' },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      return parsearItems(xml, feed.nome, tipoFonte);
    },
    { fallback: [] as FeedItem[] }
  );
}

// ─── APIs de notícias ─────────────────────────────────────────────────────────
async function fetchGNews(): Promise<FeedItem[]> {
  const key = process.env.GNEWS_API_KEY;
  if (!key) return [];
  const items: FeedItem[] = [];
  for (const termo of TERMOS.slice(0, 3)) {
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(termo)}&lang=pt&country=br&max=10&apikey=${key}`;
    const data = await safeRun(
      async () => {
        const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
        return res.json() as Promise<{ articles?: { title: string; url: string; description: string; publishedAt: string; image?: string }[] }>;
      },
      { fallback: { articles: [] } }
    );
    for (const a of data.articles ?? []) {
      if (!a.title || !a.url) continue;
      items.push({
        titulo: a.title,
        url: a.url,
        conteudo: a.description ?? '',
        publicadoEm: new Date(a.publishedAt),
        imagemUrl: a.image,
        fonteNome: 'GNews',
        tipoFonte: 'api',
      });
    }
  }
  return items;
}

async function fetchNewsData(): Promise<FeedItem[]> {
  const key = process.env.NEWSDATA_API_KEY;
  if (!key) return [];
  const items: FeedItem[] = [];
  for (const termo of TERMOS.slice(0, 3)) {
    const url = `https://newsdata.io/api/1/news?apikey=${key}&q=${encodeURIComponent(termo)}&language=pt&country=br`;
    const data = await safeRun(
      async () => {
        const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
        return res.json() as Promise<{ results?: { title: string; link: string; description: string | null; pubDate: string; image_url?: string }[] }>;
      },
      { fallback: { results: [] } }
    );
    for (const a of data.results ?? []) {
      if (!a.title || !a.link) continue;
      items.push({
        titulo: a.title,
        url: a.link,
        conteudo: a.description ?? '',
        publicadoEm: new Date(a.pubDate),
        imagemUrl: a.image_url,
        fonteNome: 'NewsData',
        tipoFonte: 'api',
      });
    }
  }
  return items;
}

async function fetchCurrents(): Promise<FeedItem[]> {
  const key = process.env.CURRENTS_API_KEY;
  if (!key) return [];
  const termo = TERMOS[0];
  const url = `https://api.currentsapi.services/v1/search?keywords=${encodeURIComponent(termo)}&language=pt&apiKey=${key}`;
  const data = await safeRun(
    async () => {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      return res.json() as Promise<{ news?: { title: string; url: string; description: string; published: string; image?: string }[] }>;
    },
    { fallback: { news: [] } }
  );
  return (data.news ?? []).map(a => ({
    titulo: a.title,
    url: a.url,
    conteudo: a.description ?? '',
    publicadoEm: new Date(a.published),
    imagemUrl: a.image && a.image !== 'None' ? a.image : undefined,
    fonteNome: 'Currents',
    tipoFonte: 'api' as TipoFonte,
  })).filter(a => a.titulo && a.url);
}

async function fetchNewsAPI(): Promise<FeedItem[]> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return [];
  const termo = TERMOS[1];
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(termo)}&language=pt&pageSize=20&apiKey=${key}`;
  const data = await safeRun(
    async () => {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      return res.json() as Promise<{ articles?: { title: string; url: string; description: string | null; publishedAt: string; urlToImage?: string }[] }>;
    },
    { fallback: { articles: [] } }
  );
  return (data.articles ?? [])
    .filter(a => a.title !== '[Removed]' && a.url)
    .map(a => ({
      titulo: a.title,
      url: a.url,
      conteudo: a.description ?? '',
      publicadoEm: new Date(a.publishedAt),
      imagemUrl: a.urlToImage,
      fonteNome: 'NewsAPI',
      tipoFonte: 'api' as TipoFonte,
    }));
}

// ─── Validação de data ────────────────────────────────────────────────────────
function dentroDoLimite(item: FeedItem): boolean {
  const agora = Date.now();
  const diff = agora - item.publicadoEm.getTime();
  const limiteMs = item.tipoFonte === 'rss-dedicado' ? 24 * 3600_000 : 48 * 3600_000;
  if (diff < 0 && Math.abs(diff) > 5 * 60_000) return false; // data futura
  return diff <= limiteMs;
}

// ─── Export principal ─────────────────────────────────────────────────────────
export type FeedStats = Record<string, number>;

export async function fetchFeeds(modo: string = 'todos'): Promise<{ items: FeedItem[]; feedStats: FeedStats }> {
  const feedStats: FeedStats = {};
  let all: FeedItem[] = [];

  if (modo === 'todos' || modo === 'apis') {
    const [gnews, newsdata, currents, newsapi] = await Promise.all([
      fetchGNews(), fetchNewsData(), fetchCurrents(), fetchNewsAPI(),
    ]);
    for (const [nome, lote] of [['GNews', gnews], ['NewsData', newsdata], ['Currents', currents], ['NewsAPI', newsapi]] as [string, FeedItem[]][]) {
      feedStats[nome] = lote.length;
      all.push(...lote);
    }
  }

  if (modo === 'todos' || modo === 'feeds' || modo === 'feeds-rapidos') {
    const resultados = await Promise.all(FEEDS_GERAL.map(f => fetchRSSFeed(f, 'rss-geral')));
    for (let i = 0; i < FEEDS_GERAL.length; i++) {
      feedStats[FEEDS_GERAL[i].nome] = resultados[i].length;
      all.push(...resultados[i]);
    }
  }

  if (modo === 'todos' || modo === 'feeds' || modo === 'feeds-dedicados') {
    const resultados = await Promise.all(FEEDS_DEDICADO.map(f => fetchRSSFeed(f, 'rss-dedicado')));
    for (let i = 0; i < FEEDS_DEDICADO.length; i++) {
      feedStats[FEEDS_DEDICADO[i].nome] = resultados[i].length;
      all.push(...resultados[i]);
    }
  }

  // Filtrar por data e remover sem título/url
  const validos = all.filter(i => i.titulo && i.url && dentroDoLimite(i));

  return { items: validos, feedStats };
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npm run type-check
```

Expected: sem erros em `feed-fetcher.ts`.

- [ ] **Step 3: Commit**

```powershell
git add lib/noticias/feed-fetcher.ts
git commit -m "feat(pipeline): coleta RSS + 4 APIs (feed-fetcher)"
```

---

## Task 4: Filtro de Relevância (`relevance-filter.ts`)

**Files:**
- Create: `lib/noticias/relevance-filter.ts`

- [ ] **Step 1: Criar `lib/noticias/relevance-filter.ts`**

```ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { FeedItem } from './types';
import { safeRun } from './utils';

// ─── Camada 1: Score rápido por keywords ─────────────────────────────────────
const PESOS: [string, number][] = [
  ['metalmecânica', 4],
  ['metalurgia', 3],
  ['siderurgia', 3],
  ['usiminas', 2],
  ['vallourec', 2],
  ['csn', 2],
  ['abimaq', 2],
  ['aço', 2],
  ['indústria metal', 2],
  ['automação industrial', 2],
  ['confab', 1],
  ['fornos industriais', 1],
  ['mercado industrial', 1],
  ['exportação aço', 1],
  ['mineração', 1],
  ['siderúrgica', 1],
  ['laminação', 1],
  ['fundição', 1],
];

export function scoreRapido(titulo: string): number {
  const lower = titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let score = 0;
  for (const [palavra, peso] of PESOS) {
    const normalizada = palavra.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (lower.includes(normalizada)) score += peso;
  }
  return score;
}

// ─── Camada 2: Filtro IA via Gemini ──────────────────────────────────────────
let genAI: GoogleGenerativeAI | null = null;

function getGemini() {
  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
}

type FiltroIAResult = {
  relevante: boolean;
  score: number;
  tipo: string;
};

export async function filtrarRelevanciaIA(item: FeedItem): Promise<FiltroIAResult> {
  return safeRun(
    async () => {
      const model = getGemini();
      const prompt = `Você é um filtro de notícias do setor metalmecânico brasileiro.
Avalie se a notícia abaixo é relevante para profissionais do setor metal-mecânico, siderurgia, metalurgia, automação industrial ou indústria pesada no Brasil.
Responda APENAS com JSON válido, sem markdown, sem explicações:
{"relevante": boolean, "score": number, "tipo": "mercado|produto|empresa|regulatorio|tecnologia|irrelevante"}
onde score é um número de 0 a 1.

NOTÍCIA:
Título: ${item.titulo}
Conteúdo: ${item.conteudo.slice(0, 400)}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      // Remove possível markdown ```json ... ```
      const json = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(json) as FiltroIAResult;
    },
    { fallback: { relevante: true, score: 0.5, tipo: 'mercado' } }
  );
}

export function aplicarScoreRapidoEOrdenar(items: FeedItem[]): Array<FeedItem & { score: number }> {
  return items
    .map(item => ({ ...item, score: scoreRapido(item.titulo) }))
    .filter(item => item.score >= 1)
    .sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npm run type-check
```

Expected: sem erros em `relevance-filter.ts`.

- [ ] **Step 3: Commit**

```powershell
git add lib/noticias/relevance-filter.ts
git commit -m "feat(pipeline): filtro relevância keywords + Gemini"
```

---

## Task 5: Reescrita com IA (`ai-rewriter.ts`)

**Files:**
- Create: `lib/noticias/ai-rewriter.ts`

- [ ] **Step 1: Criar `lib/noticias/ai-rewriter.ts`**

```ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { FeedItem } from './types';
import { safeRun } from './utils';

let genAI: GoogleGenerativeAI | null = null;

function getGemini() {
  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
}

type RewriteResult = {
  titulo: string;
  resumo: string;
  categoria: string;
  regiao: string;
};

export async function reescreverComIA(item: FeedItem): Promise<RewriteResult> {
  return safeRun(
    async () => {
      const model = getGemini();
      const prompt = `Você é editor do Portal Metalmecânica, portal de notícias do setor industrial brasileiro.
Reescreva a notícia abaixo em português brasileiro jornalístico, focando no interesse para profissionais do setor metalmecânico.
Responda APENAS com JSON válido, sem markdown, sem explicações:
{
  "titulo": "string (máximo 90 caracteres, objetivo e informativo)",
  "resumo": "string (máximo 200 caracteres, resume o fato principal)",
  "categoria": "uma de: Mercado|Tecnologia|Industria|Emprego|Legislacao|Eventos|Siderurgia|Energia",
  "regiao": "uma de: ES|MG|Brasil|Internacional"
}

NOTÍCIA ORIGINAL:
Título: ${item.titulo}
Fonte: ${item.fonteNome}
Conteúdo: ${item.conteudo.slice(0, 600)}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const json = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(json) as RewriteResult;

      // Garantir limites de tamanho
      return {
        titulo: (parsed.titulo || item.titulo).slice(0, 90),
        resumo: (parsed.resumo || item.conteudo).slice(0, 200),
        categoria: ['Mercado', 'Tecnologia', 'Industria', 'Emprego', 'Legislacao', 'Eventos', 'Siderurgia', 'Energia'].includes(parsed.categoria)
          ? parsed.categoria
          : 'Mercado',
        regiao: ['ES', 'MG', 'Brasil', 'Internacional'].includes(parsed.regiao)
          ? parsed.regiao
          : 'Brasil',
      };
    },
    {
      fallback: {
        titulo: item.titulo.slice(0, 90),
        resumo: item.conteudo.slice(0, 200),
        categoria: 'Mercado',
        regiao: 'Brasil',
      },
    }
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npm run type-check
```

Expected: sem erros em `ai-rewriter.ts`.

- [ ] **Step 3: Commit**

```powershell
git add lib/noticias/ai-rewriter.ts
git commit -m "feat(pipeline): reescrita de título/resumo com Gemini"
```

---

## Task 6: Enriquecimento de Imagem (`image-sourcer.ts`)

**Files:**
- Create: `lib/noticias/image-sourcer.ts`

- [ ] **Step 1: Criar `lib/noticias/image-sourcer.ts`**

```ts
import type { FeedItem } from './types';
import { safeRun } from './utils';

const UA = 'Mozilla/5.0 (compatible; PortalMetalmecanica/1.0)';

function isImagemValida(url: string): boolean {
  if (!url || !url.startsWith('http')) return false;
  const lower = url.toLowerCase();
  // Rejeitar SVG, GIF, favicons, ícones
  if (lower.endsWith('.svg') || lower.endsWith('.gif')) return false;
  if (lower.includes('favicon') || lower.includes('icon') || lower.includes('logo')) return false;
  return true;
}

async function extrairOgImage(url: string): Promise<string | null> {
  return safeRun(
    async () => {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const html = await res.text();

      // og:image
      const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                   || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (ogMatch && isImagemValida(ogMatch[1])) return ogMatch[1];

      // twitter:image
      const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
                   || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
      if (twMatch && isImagemValida(twMatch[1])) return twMatch[1];

      // Primeira imagem dentro de <article> ou <main>
      const bodyMatch = html.match(/<(?:article|main)[^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i);
      if (bodyMatch && isImagemValida(bodyMatch[1])) return bodyMatch[1];

      return null;
    },
    { fallback: null }
  );
}

export async function resolverImagem(item: FeedItem): Promise<string | null> {
  // 1. Imagem já na API/RSS
  if (item.imagemUrl && isImagemValida(item.imagemUrl)) {
    return item.imagemUrl;
  }

  // 2. Scraping og:image do artigo original
  const scraped = await extrairOgImage(item.url);
  if (scraped) return scraped;

  // 3. Sem imagem — o publisher usará placeholder
  return null;
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npm run type-check
```

Expected: sem erros em `image-sourcer.ts`.

- [ ] **Step 3: Commit**

```powershell
git add lib/noticias/image-sourcer.ts
git commit -m "feat(pipeline): enriquecimento de imagem com fallback"
```

---

## Task 7: Publicação (`publisher.ts`)

**Files:**
- Create: `lib/noticias/publisher.ts`

- [ ] **Step 1: Criar `lib/noticias/publisher.ts`**

```ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { FeedItem } from './types';
import { slugifyTitulo, normT } from './utils';

function getServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type Existentes = {
  urls: Set<string>;
  titulos: Set<string>;
};

export async function buscarExistentes(): Promise<Existentes> {
  const supabase = getServiceClient();
  const setesDias = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  const { data } = await supabase
    .from('posts')
    .select('fonte_url, title')
    .gte('created_at', setesDias);

  const urls = new Set<string>();
  const titulos = new Set<string>();

  for (const row of data ?? []) {
    if (row.fonte_url) urls.add(row.fonte_url);
    if (row.title) titulos.add(normT(row.title));
  }

  return { urls, titulos };
}

export function ehDuplicata(
  item: FeedItem,
  existentes: Existentes,
  linksSeen: Set<string>,
  titulosSeen: Set<string>
): boolean {
  if (existentes.urls.has(item.url) || linksSeen.has(item.url)) return true;
  const tNorm = normT(item.titulo);
  if (existentes.titulos.has(tNorm) || titulosSeen.has(tNorm)) return true;
  return false;
}

export function marcarVisto(
  item: FeedItem,
  linksSeen: Set<string>,
  titulosSeen: Set<string>
): void {
  linksSeen.add(item.url);
  titulosSeen.add(normT(item.titulo));
}

async function gerarSlugUnico(supabase: ReturnType<typeof getServiceClient>, base: string): Promise<string> {
  let slug = base;
  let tentativa = 0;
  while (true) {
    const { data } = await supabase
      .from('posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!data) return slug;
    tentativa++;
    slug = `${base}-${tentativa}`;
  }
}

export type DadosPublicacao = FeedItem & {
  tituloFinal: string;
  resumoFinal: string;
  categoria: string;
  regiao: string;
  imagemFinal: string | null;
};

export async function publicarNoticia(dados: DadosPublicacao): Promise<void> {
  const supabase = getServiceClient();
  const slugBase = slugifyTitulo(dados.tituloFinal);
  const slug = await gerarSlugUnico(supabase, slugBase);

  const { error } = await supabase.from('posts').insert({
    slug,
    title: dados.tituloFinal,
    excerpt: dados.resumoFinal,
    content: dados.conteudo || dados.resumoFinal,
    featured_image: dados.imagemFinal,
    category: dados.categoria,
    region: dados.regiao,
    author_id: null,
    published_at: new Date().toISOString(),
    is_exclusive: false,
    fonte_url: dados.url,
    fonte_nome: dados.fonteNome,
    is_auto: true,
  });

  if (error) throw new Error(`Supabase insert: ${error.message}`);
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npm run type-check
```

Expected: sem erros em `publisher.ts`.

- [ ] **Step 3: Commit**

```powershell
git add lib/noticias/publisher.ts
git commit -m "feat(pipeline): deduplicação e publicação no Supabase"
```

---

## Task 8: Orquestrador (`route.ts`)

**Files:**
- Create: `app/api/cron/buscar-noticias/route.ts`

- [ ] **Step 1: Criar `app/api/cron/buscar-noticias/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchFeeds } from '@/lib/noticias/feed-fetcher';
import { aplicarScoreRapidoEOrdenar, filtrarRelevanciaIA } from '@/lib/noticias/relevance-filter';
import { reescreverComIA } from '@/lib/noticias/ai-rewriter';
import { resolverImagem } from '@/lib/noticias/image-sourcer';
import {
  buscarExistentes,
  ehDuplicata,
  marcarVisto,
  publicarNoticia,
} from '@/lib/noticias/publisher';
import { processarComConcorrencia } from '@/lib/noticias/utils';
import type { ResultadoPipeline } from '@/lib/noticias/types';

const MAX_INSERCOES = 30;
const MAX_ERROS_CONSECUTIVOS = 10;

function isAutorizado(req: NextRequest): boolean {
  return (
    req.headers.get('x-vercel-cron') === '1' ||
    req.nextUrl.searchParams.get('secret') === process.env.CRON_SECRET
  );
}

export async function GET(req: NextRequest) {
  if (!isAutorizado(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const modo = req.nextUrl.searchParams.get('modo') ?? 'todos';
  const dry = req.nextUrl.searchParams.get('dry') === 'true';

  const resultado: ResultadoPipeline = {
    inseridas: 0,
    duplicadas: 0,
    irrelevantes: 0,
    erros: 0,
    abortado: false,
    feedStats: {},
  };

  try {
    // 1. Coleta
    const { items, feedStats } = await fetchFeeds(modo);
    resultado.feedStats = feedStats;

    if (items.length === 0) {
      return NextResponse.json({ ...resultado, msg: 'Nenhum item coletado' });
    }

    // 2. Score rápido + ordenar (já filtra score < 1)
    const comScore = aplicarScoreRapidoEOrdenar(items);

    // 3. Buscar existentes no banco
    const existentes = await buscarExistentes();
    const linksSeen = new Set<string>();
    const titulosSeen = new Set<string>();

    let errosConsecutivos = 0;

    // 4. Processar com concorrência 3
    await processarComConcorrencia(
      comScore,
      async (item) => {
        if (resultado.inseridas >= MAX_INSERCOES || resultado.abortado) return;

        try {
          // Deduplicação
          if (ehDuplicata(item, existentes, linksSeen, titulosSeen)) {
            resultado.duplicadas++;
            return;
          }

          // Filtro IA
          const filtro = await filtrarRelevanciaIA(item);
          if (!filtro.relevante || filtro.score < 0.4) {
            resultado.irrelevantes++;
            return;
          }

          // Reescrita
          const rewrite = await reescreverComIA(item);

          // Imagem
          const imagemFinal = await resolverImagem(item);

          // Publicar (ou apenas marcar em dry run)
          if (!dry) {
            await publicarNoticia({
              ...item,
              tituloFinal: rewrite.titulo,
              resumoFinal: rewrite.resumo,
              categoria: rewrite.categoria,
              regiao: rewrite.regiao,
              imagemFinal,
            });
          }

          marcarVisto(item, linksSeen, titulosSeen);
          resultado.inseridas++;
          errosConsecutivos = 0;
        } catch {
          resultado.erros++;
          errosConsecutivos++;
          if (errosConsecutivos >= MAX_ERROS_CONSECUTIVOS) {
            resultado.abortado = true;
          }
        }
      },
      3
    );
  } catch (err) {
    return NextResponse.json(
      { ...resultado, error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }

  return NextResponse.json(resultado);
}
```

- [ ] **Step 2: Verificar TypeScript**

```powershell
npm run type-check
```

Expected: sem erros em `route.ts`.

- [ ] **Step 3: Commit**

```powershell
git add app/api/cron/buscar-noticias/route.ts
git commit -m "feat(pipeline): orquestrador cron route"
```

---

## Task 9: Cron Vercel + Variáveis de Ambiente

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Criar `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/buscar-noticias",
      "schedule": "0 */3 * * *"
    }
  ]
}
```

- [ ] **Step 2: Configurar variáveis de ambiente no Vercel**

Acessar o painel Vercel → Settings → Environment Variables e adicionar:

```
GNEWS_API_KEY          = <sua chave>
CURRENTS_API_KEY       = <sua chave>
NEWSDATA_API_KEY       = <sua chave>
NEWSAPI_KEY            = <sua chave>
GEMINI_API_KEY         = <sua chave Gemini>
CRON_SECRET            = <string aleatória ex: openssl rand -hex 32>
```

As variáveis `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já devem existir.

- [ ] **Step 3: Adicionar ao `.env.local` para desenvolvimento**

Adicionar ao `.env.local` (já existe, não commitar):

```
GNEWS_API_KEY=
CURRENTS_API_KEY=
NEWSDATA_API_KEY=
NEWSAPI_KEY=
GEMINI_API_KEY=
CRON_SECRET=dev-secret-local
```

- [ ] **Step 4: Commit**

```powershell
git add vercel.json
git commit -m "feat(pipeline): cron Vercel a cada 3 horas"
```

---

## Task 10: Smoke Test End-to-End

- [ ] **Step 1: Iniciar servidor de desenvolvimento**

```powershell
npm run dev
```

Expected: servidor rodando em `http://localhost:3005`

- [ ] **Step 2: Testar dry run (sem inserir no banco)**

```powershell
curl "http://localhost:3005/api/cron/buscar-noticias?secret=dev-secret-local&modo=apis&dry=true"
```

Expected: JSON com `inseridas: 0` e `feedStats` mostrando quantos itens cada API retornou. Sem erros 500.

- [ ] **Step 3: Testar apenas feeds RSS em dry run**

```powershell
curl "http://localhost:3005/api/cron/buscar-noticias?secret=dev-secret-local&modo=feeds-rapidos&dry=true"
```

Expected: JSON com `feedStats` mostrando itens por fonte RSS. Se algum feed retornar 0, verificar a URL do feed no `feed-fetcher.ts`.

- [ ] **Step 4: Testar inserção real com modo limitado**

```powershell
curl "http://localhost:3005/api/cron/buscar-noticias?secret=dev-secret-local&modo=apis"
```

Expected: JSON com `inseridas > 0` (se GEMINI_API_KEY estiver configurada). Verificar no painel Supabase que posts com `is_auto = true` foram inseridos.

- [ ] **Step 5: Verificar posts na home**

Acessar `http://localhost:3005/` e confirmar que os novos posts aparecem no grid de últimas notícias.

- [ ] **Step 6: Verificar sem CRON_SECRET (deve retornar 401)**

```powershell
curl "http://localhost:3005/api/cron/buscar-noticias"
```

Expected: `{"error":"Não autorizado"}` com status 401.

- [ ] **Step 7: Commit final**

```powershell
git add .
git commit -m "feat: pipeline automático de notícias completo"
git push origin main
```

---

## Notas de Manutenção

- **URLs de RSS:** Algumas URLs de feeds podem mudar ou ficar offline. Se `feedStats[nome] === 0` após uma execução real, verificar e atualizar a URL em `feed-fetcher.ts`.
- **Quota Gemini:** Gemini Flash tem 1500 req/dia no plano gratuito. Com max 30 inserções a cada 3h (8 execuções/dia), o consumo máximo é ~480 chamadas/dia (2 por notícia: filtro + rewrite).
- **Kill switch:** Se `abortado: true` aparecer nos logs, verificar qual serviço está falhando (Supabase, Gemini ou scraping).
- **Moderação:** Posts automáticos têm `is_auto = true`. No painel admin, é possível filtrar e remover posts automáticos irrelevantes.
