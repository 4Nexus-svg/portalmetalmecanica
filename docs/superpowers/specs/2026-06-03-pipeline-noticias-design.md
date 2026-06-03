# Pipeline Automático de Notícias — Design Spec

**Data:** 2026-06-03  
**Status:** Aprovado  
**Projeto:** Portal Metalmecânica

---

## Contexto

O portal precisa de um fluxo contínuo de notícias do setor metalmecânico sem depender de curadoria manual. O sistema coleta de RSS + 4 APIs de notícias, filtra por relevância (keywords + IA), deduplica, enriquece com imagem e publica automaticamente na tabela `posts` existente.

---

## Decisões de Arquitetura

| Decisão | Escolha | Motivo |
|---|---|---|
| Tabela de destino | `posts` existente + 3 colunas novas | Reutiliza RLS, busca full-text, pages — zero reescrita |
| Publicação | Imediata (`published_at = NOW()`) | Portal sempre atualizado, sem curadoria manual |
| Provider IA | Gemini Flash | Já usado no projeto FlanewsTV, gratuito até certo limite |
| Frequência | A cada 3 horas (`0 */3 * * *`) | Equilíbrio entre atualização e consumo de quota de APIs |
| Máx por execução | 30 inserções | Evita esgotar quotas diárias em uma rodada |

---

## 1. Schema — Migration

**Arquivo:** `supabase/migrations/002_pipeline_columns.sql`

```sql
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS fonte_url  TEXT,
  ADD COLUMN IF NOT EXISTS fonte_nome TEXT,
  ADD COLUMN IF NOT EXISTS is_auto    BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_posts_fonte_url ON public.posts(fonte_url)
  WHERE fonte_url IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_is_auto ON public.posts(is_auto)
  WHERE is_auto = true;
```

Atualizar também `types/database.ts` para incluir os 3 campos na interface `posts`.

---

## 2. Estrutura de Arquivos

```
lib/noticias/
  types.ts              — interfaces FeedItem, ItemComScore, ResultadoPipeline
  utils.ts              — safeRun, processarComConcorrencia, slugify, normT
  feed-fetcher.ts       — fetchAPIs() + fetchRSS()
  relevance-filter.ts   — scoreRapido() + filtrarRelevanciaIA() via Gemini
  ai-rewriter.ts        — reescreverComIA() via Gemini
  image-sourcer.ts      — resolverImagem() com hierarquia de fallback
  publisher.ts          — buscarExistentes(), ehDuplicata(), publicarNoticia()

app/api/cron/buscar-noticias/route.ts   — orquestrador do pipeline
supabase/migrations/002_pipeline_columns.sql
vercel.json                             — cron schedule
```

**Regra:** módulos importam apenas de `types.ts` e `utils.ts`. Só o orquestrador encadeia módulos entre si.

---

## 3. Tipos Principais (`types.ts`)

```ts
type FeedItem = {
  titulo: string
  url: string
  conteudo: string
  publicadoEm: Date
  imagemUrl?: string
  fonteNome: string
  tipoFonte: 'api' | 'rss-geral' | 'rss-dedicado'
}

type ItemComScore = FeedItem & { score: number }

type ResultadoPipeline = {
  inseridas: number
  duplicadas: number
  irrelevantes: number
  erros: number
  feedStats: Record<string, number>
}
```

---

## 4. Coleta (`feed-fetcher.ts`)

### APIs de Notícias

Termos de busca: `"metalmecânica Brasil"`, `"indústria metal mecânica"`, `"siderurgia Brasil"`, `"metalurgia mercado"`, `"aço Brasil"`, `"Usiminas"`, `"CSN siderurgia"`, `"automação industrial Brasil"`, `"ABIMAQ"`, `"Vallourec"`

| API | Endpoint base |
|---|---|
| GNews | `https://gnews.io/api/v4/search?q=...&lang=pt&country=br` |
| Currents | `https://api.currentsapi.services/v1/search?keywords=...` |
| NewsData.io | `https://newsdata.io/api/1/news?apikey=...&q=...&language=pt` |
| NewsAPI | `https://newsapi.org/v2/everything?q=...&language=pt` |

### Feeds RSS por categoria

**Espírito Santo:** A Gazeta, Folha Vitória, ES Hoje  
**Minas Gerais:** Estado de Minas, Hoje em Dia, O Tempo  
**Brasil Industrial:** Agência Brasil, Valor Econômico, Exame, InfoMoney  
**Setores:** ANEEL, ONS, ANP, Petrobras, Vale, IBRAM, IBÁ, Suzano, blogs Siemens/Schneider

Parsing RSS manual com regex:
- `<title>`, `<link>`, `<description>`, `<pubDate>` / `<dc:date>` / `<updated>`
- `<media:content url="...">`, `<media:thumbnail url="...">`, `<enclosure url="...">`

---

## 5. Validação de Data

```
rss-geral:    rejeita se publicadoEm < NOW() - 48h
rss-dedicado: rejeita se publicadoEm < NOW() - 24h
api:          rejeita se publicadoEm < NOW() - 48h
Rejeitar datas futuras (tolerância: +5min para clock skew)
Rejeitar itens sem data
```

Normalização de timezones: `BRT → -0300`, `BRST → -0200`

---

## 6. Filtro de Relevância (`relevance-filter.ts`)

### Camada 1 — Score rápido (síncrono)

```ts
const PESOS: [string, number][] = [
  ['metalmecânica', 4], ['metalurgia', 3], ['siderurgia', 3],
  ['aço', 2], ['indústria metal', 2], ['automação industrial', 2],
  ['ABIMAQ', 2], ['Usiminas', 2], ['CSN', 1], ['Vallourec', 1],
  ['fornos industriais', 1], ['mercado industrial', 1], ['exportação aço', 1],
]
// Rejeitar se score < 1
```

### Camada 2 — Filtro IA (Gemini Flash)

```
Prompt: "Você é um filtro de notícias do setor metalmecânico brasileiro.
Responda APENAS JSON válido:
{"relevante": boolean, "score": number (0-1), "tipo": "mercado|produto|empresa|regulatorio|tecnologia|irrelevante"}
NOTÍCIA: Título: {titulo} Conteúdo: {conteudo}"
```

Rejeitar se `score < 0.4`.

---

## 7. Deduplicação (`publisher.ts`)

Dois checks em memória por execução + check no banco:

1. **Por URL exata** — `linksSeen: Set<string>`
2. **Por título normalizado** (60 chars):

```ts
function normT(t: string): string {
  return t.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ')
    .trim().slice(0, 60)
}
```

3. **Check Supabase** — buscar `fonte_url` e `title` dos últimos 7 dias antes de iniciar

---

## 8. Reescrita com IA (`ai-rewriter.ts`)

```
Prompt: "Reescreva em português brasileiro jornalístico para o Portal Metalmecânica.
Retorne JSON: {"titulo": string (max 90 chars), "resumo": string (max 200 chars),
"categoria": "Mercado|Tecnologia|Industria|Emprego|Legislacao|Eventos|Siderurgia|Energia",
"regiao": "ES|MG|Brasil|Internacional"}
ORIGINAL: Título: {titulo} Conteúdo: {conteudo}"
```

---

## 9. Enriquecimento de Imagem (`image-sourcer.ts`)

Hierarquia de fallback:
1. Imagem retornada pela API (GNews, NewsData já incluem)
2. `<media:content>` ou `<media:thumbnail>` do RSS
3. Scraping do artigo: `og:image` → `twitter:image` → `<img>` em `<article>/<main>`
4. Placeholder: `/og-image.png`

Rejeitar imagem se: SVG, GIF, favicon, dimensões < 200×150, ou URL inacessível em 5s.

Scraping usa User-Agent real: `Mozilla/5.0 (compatible; PortalMetalmecanica/1.0)`

---

## 10. Publicação (`publisher.ts`)

```ts
await supabase.from('posts').insert({
  slug,                    // slugify(titulo) + sufixo único se colisão
  title: tituloReescrito,
  excerpt: resumoReescrito,
  content: conteudoOriginal,
  featured_image: imagemUrl,
  category,
  region,
  author_id: null,         // posts automáticos sem autor
  published_at: new Date().toISOString(),
  is_exclusive: false,
  fonte_url: item.url,
  fonte_nome: item.fonteNome,
  is_auto: true,
})
```

---

## 11. Utilitários (`utils.ts`)

```ts
// Retry com backoff exponencial + timeout
async function safeRun<T>(
  fn: () => Promise<T>,
  opts: { tentativas?: number; delayBase?: number; timeout?: number; fallback?: T }
): Promise<T>

// Processa array com N workers em paralelo
async function processarComConcorrencia<T>(
  itens: T[],
  fn: (item: T) => Promise<void>,
  concorrencia = 3
): Promise<void>
```

Delays: tentativa 1 → 500ms, tentativa 2 → 1000ms, tentativa 3 → desiste.  
Timeout padrão: 15s por chamada.

---

## 12. Orquestrador (`route.ts`)

```
GET /api/cron/buscar-noticias?modo=todos|apis|feeds|feeds-rapidos|feeds-dedicados

Auth: header x-vercel-cron: 1  OU  ?secret=CRON_SECRET
Kill switch: abort após 10 erros consecutivos
Limite: 30 inserções por execução
Resposta: JSON ResultadoPipeline
```

---

## 13. Cron (`vercel.json`)

```json
{
  "crons": [{
    "path": "/api/cron/buscar-noticias",
    "schedule": "0 */3 * * *"
  }]
}
```

---

## 14. Variáveis de Ambiente

```
# Novas
GNEWS_API_KEY
CURRENTS_API_KEY
NEWSDATA_API_KEY
NEWSAPI_KEY
GEMINI_API_KEY
CRON_SECRET

# Já existem
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

---

## Ordem de Implementação

1. Migration SQL + atualizar `types/database.ts`
2. `lib/noticias/types.ts`
3. `lib/noticias/utils.ts`
4. `lib/noticias/feed-fetcher.ts`
5. `lib/noticias/relevance-filter.ts`
6. `lib/noticias/ai-rewriter.ts`
7. `lib/noticias/image-sourcer.ts`
8. `lib/noticias/publisher.ts`
9. `app/api/cron/buscar-noticias/route.ts`
10. `vercel.json`
