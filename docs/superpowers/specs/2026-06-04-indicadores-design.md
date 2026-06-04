# Spec: Seção Indicadores

**Data:** 2026-06-04  
**Status:** Aprovado  
**Autor:** maxthomazi@gmail.com

---

## Objetivo

Implementar a seção Indicadores do Portal Metalmecânica com dados econômicos e de commodities atualizados automaticamente via cron, armazenados no Supabase, com página principal estilo InfoMoney e páginas de detalhe por indicador.

---

## Indicadores

| Slug | Nome | Grupo | API | Frequência |
|---|---|---|---|---|
| `dolar` | Dólar | Financeiros | AwesomeAPI `USD-BRL` | Horária |
| `euro` | Euro | Financeiros | AwesomeAPI `EUR-BRL` | Horária |
| `ibovespa` | Ibovespa | Financeiros | brapi.dev `^BVSP` | Horária |
| `selic` | Selic | Financeiros | BCB OLINDA série 11 | Diária |
| `petroleo` | Petróleo Brent | Commodities | brapi.dev `BZ=F` | Horária |
| `minerio` | Minério de Ferro | Commodities | brapi.dev `TIO=F` | Diária |
| `aco` | Aço | Commodities | brapi.dev `HRC=F` | Diária |
| `aluminio` | Alumínio | Commodities | brapi.dev `ALI=F` | Diária |
| `cobre` | Cobre | Commodities | brapi.dev `HG=F` | Diária |
| `exportacoes` | Exportações ES & MG | Regional | MDIC Comex Stat | Mensal |
| `producao` | Produção Industrial ES & MG | Regional | IBGE SIDRA | Mensal |

---

## Banco de Dados

### Tabela `indicadores_snapshots`

```sql
CREATE TABLE indicadores_snapshots (
  id           SERIAL PRIMARY KEY,
  slug         TEXT NOT NULL,
  value        NUMERIC NOT NULL,
  variation    NUMERIC,
  raw_data     JSONB,
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ind_slug_time ON indicadores_snapshots(slug, captured_at DESC);
```

### Tabela `indicadores_config`

```sql
CREATE TABLE indicadores_config (
  slug         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  group_name   TEXT NOT NULL,
  unit         TEXT NOT NULL,        -- 'R$', 'pts', '%', 'USD/bbl', etc.
  decimals     INT NOT NULL DEFAULT 2,
  frequency    TEXT NOT NULL,        -- 'horária', 'diária', 'mensal'
  source_label TEXT NOT NULL,        -- nome exibível da fonte
  source_url   TEXT,
  description  TEXT,                 -- contexto para página de detalhe
  active       BOOLEAN NOT NULL DEFAULT true
);
```

**RLS:** `indicadores_snapshots` e `indicadores_config` têm SELECT público (sem autenticação), INSERT/UPDATE apenas via `service_role` (usada pelos crons).

---

## Rotas de API (cron endpoints)

Todas protegidas por header `Authorization: Bearer <CRON_SECRET>`.

| Rota | Método | Indicadores | Frequência no cron-job.org |
|---|---|---|---|
| `/api/indicadores/sync/mercado` | POST | Dólar, Euro, Ibovespa, Brent | A cada hora |
| `/api/indicadores/sync/commodities` | POST | Selic, Minério, Aço, Alumínio, Cobre | Diária às 8h BRT |
| `/api/indicadores/sync/regional` | POST | Exportações, Produção Industrial | Dia 1 de cada mês |

Cada rota:
1. Busca os dados nas APIs externas
2. Calcula `variation` em relação ao último snapshot do mesmo slug
3. Insere em `indicadores_snapshots`
4. Retorna `{ ok: true, updated: [...slugs] }`

---

## Estrutura de Arquivos

```
app/
  indicadores/
    page.tsx                    ← página principal (todos os cards)
    [slug]/
      page.tsx                  ← página de detalhe
  api/
    indicadores/
      sync/
        mercado/route.ts        ← cron horário
        commodities/route.ts    ← cron diário
        regional/route.ts       ← cron mensal
lib/
  indicadores/
    fetchers.ts                 ← funções que buscam cada API externa
    queries.ts                  ← queries Supabase (últimos snapshots, histórico)
supabase/
  migrations/
    008_indicadores.sql
components/
  indicadores/
    IndicadorCard.tsx           ← card com valor, variação, sparkline, badge frequência
    Sparkline.tsx               ← mini gráfico SVG inline (sem lib externa)
    HistoricoChart.tsx          ← gráfico completo com recharts
    PeriodoSelector.tsx         ← seletor 7d/30d/90d/1a
```

---

## Layout — Página Principal `/indicadores`

- Título da seção + texto introdutório
- 3 grupos: **Financeiros**, **Commodities Industriais**, **Regional ES & MG**
- Grid responsivo: 4 cols desktop, 2 cols tablet, 1 col mobile
- Cada card contém:
  - Nome do indicador
  - Valor atual formatado com unidade
  - Variação colorida (verde ▲ / vermelho ▼) com percentual
  - Sparkline dos últimos 30 snapshots (SVG inline)
  - Badge de periodicidade ("atualizado a cada hora", "diário", "mensal")
  - Última atualização em timestamp legível
  - Link para página de detalhe
- Dados carregados via Server Component (ISR, revalidate 300s)

---

## Layout — Página de Detalhe `/indicadores/[slug]`

- Header: nome completo, valor atual grande, variação em destaque, fonte
- Gráfico de linha interativo (recharts `LineChart`) com seletor **7d / 30d / 90d / 1a**
- Tabela histórica (valor + variação + data), paginada por 20 linhas
- Box lateral: "Por que este indicador importa para o setor metalmecânico" (texto da `indicadores_config.description`)
- Badge de periodicidade e link para fonte original

---

## Variáveis de Ambiente Necessárias

| Variável | Uso |
|---|---|
| `CRON_SECRET` | Autenticar chamadas do cron-job.org |
| `NEXT_PUBLIC_SUPABASE_URL` | já existe |
| `SUPABASE_SERVICE_ROLE_KEY` | já existe (para INSERT nos crons) |

---

## Decisões de Design

- **Sem lib de gráfico externa na página principal** — sparkline é SVG inline (performance). Recharts apenas nas páginas de detalhe.
- **brapi.dev para commodities** — Yahoo Finance tickers via proxy gratuito, sem chave. Limite generoso para uso do portal.
- **`indicadores_config` editável** — permite ajustar descrições, unidades e desativar indicadores sem deploy.
- **Série histórica permanente** — snapshots nunca deletados, permite análise futura e gráficos de longo prazo.
- **ISR 300s na página principal** — dados nunca velhos demais, sem custo de SSR em cada visita.
