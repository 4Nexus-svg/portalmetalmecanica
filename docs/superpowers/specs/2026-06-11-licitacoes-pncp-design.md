# Design: Seção Licitações PNCP

**Data:** 2026-06-11  
**Status:** Aprovado

## Objetivo

Exibir licitações públicas federais relevantes ao setor metalmecânico (capítulos NCM 72–85) de ES e MG, buscadas automaticamente do PNCP e armazenadas no Supabase.

## Abordagem escolhida

Cron diário → PNCP `/consulta` → upsert Supabase → Server Component lê do banco.  
Sem dependência em tempo real do PNCP; resiliente a instabilidades da API externa.

## Banco de dados

Tabela `licitacoes_pncp`:

```sql
id                text        PRIMARY KEY  -- {cnpj}-{ano}-{sequencial}
orgao_cnpj        text        NOT NULL
orgao_nome        text
uf                text        NOT NULL     -- 'ES' | 'MG'
objeto            text
modalidade        text
valor_estimado    numeric
data_publicacao   date
data_encerramento date
status            text        NOT NULL     -- 'aberta' | 'encerrada'
link_pncp         text
itens_catmat      text[]                   -- capítulos NCM 72–85 encontrados
updated_at        timestamptz NOT NULL DEFAULT now()
```

Índices: `(uf)`, `(status)`, `(data_encerramento DESC)`.

## Fluxo do cron

1. Recebe GET com `x-vercel-cron: 1` ou `?secret=<CRON_SECRET>`
2. Busca `/api/consulta/v1/contratacoes/publicacao?uf=ES&dataInicial=...&dataFinal=...` e `uf=MG` (últimos 30 dias, paginando até esgotar)
3. Para cada licitação, busca seus itens em `/api/pncp/v1/orgaos/{cnpj}/compras/{ano}/{seq}/itens`
4. Filtra itens com `codigoMaterial` nos capítulos 72–85 (primeiros 2 dígitos do código NCM)
5. Descarta licitações sem nenhum item metalmecanico
6. Determina `status`: `aberta` se `data_encerramento >= hoje`, senão `encerrada`
7. Upsert na tabela `licitacoes_pncp`
8. Todo o trabalho pesado roda em `waitUntil` para não estourar timeout do handler

## Arquivos a criar

| Arquivo | Responsabilidade |
|---|---|
| `app/api/cron/licitacoes/route.ts` | Handler cron + lógica de busca/filtro/upsert |
| `app/api/licitacoes/route.ts` | API pública de leitura (JSON, filtros uf/status) |
| `app/licitacoes/page.tsx` | Página pública, Server Component, revalidate 300 |

## Página pública `/licitacoes`

- Filtros via `searchParams`: `uf` (ES / MG / vazio = ambas), `status` (aberta / encerrada / vazio = todas)
- Lista de cards: objeto, órgão, modalidade, valor estimado (se disponível), data encerramento, badge status, link para PNCP
- Design alinhado com `/vagas` (mesma paleta: `#1A2B4A`, `#C9A84C`, cards `rounded-xl border`)
- Estado vazio: mensagem clara quando não há licitações

## Restrições

- O endpoint `/consulta` do PNCP tem latência alta — todo fetch fica dentro de `waitUntil`
- A busca por itens é uma chamada extra por licitação; implementar com `Promise.all` em batches de 10 para não saturar
- Não há autenticação na API de consulta do PNCP
- `CRON_SECRET` já existe no projeto (usado pelo cron comex)
