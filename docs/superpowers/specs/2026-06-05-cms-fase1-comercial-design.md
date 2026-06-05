# Spec: CMS Portal MetalMecânica — Fase 1 (Comercial)

**Data:** 2026-06-05
**Status:** Aprovado
**Autor:** maxthomazi@gmail.com

---

## Contexto

Segunda fase do CMS (a [Fase 0](2026-06-05-cms-fase0-fundacao-design.md) entregou shell, auth de 4 perfis, permissões e stubs). A Fase 1 implementa o **CRUD real das 3 seções comerciais**: Publicidade (banners), Classificados e Empresas em Destaque. Tudo reusa o shell e o modelo de permissões da Fase 0.

**Acesso:** apenas `admin` e `comercial` (na matriz da Fase 0, as três seções estão em ambos; `editor` não acessa nenhuma delas).

### Estado atual do banco (já existente)
- **`ads`** (banners): `id, name, image_url, link, position, start_date, end_date, impressions, clicks, created_at`. Consumido no site por `components/ui/BannerSlot.tsx` (posições fixas `top | sidebar | between | footer`, com rotação e filtro por vigência de datas).
- **`classifieds`**: `id, user_id, title, description, price, photos[], city, state, category, status, expires_at, payment_intent_id, created_at, phone, whatsapp`. Submetido pelo público (`status` default `pending`); o webhook do Mercado Pago (`app/api/webhooks/mercadopago`) seta `status='active'` quando o PIX é aprovado. Hoje só existem os status `pending` e `active`.
- **Não existe** tabela para Empresas em Destaque — criada nesta fase.

---

## Objetivo da Fase 1

Permitir que admin/comercial gerenciem, pelo painel, todo o conteúdo comercial: criar/editar/excluir banners com agendamento; moderar e cadastrar classificados; manter uma vitrine de empresas patrocinadas que aparece no site. Ao final, as três seções deixam de ser stubs e passam a ter CRUD funcional, com upload de imagens para o Supabase Storage.

---

## Decisões de Design

1. **Reuso total da Fase 0:** shell (`layout.tsx`, `Sidebar`, `PainelHeader`), permissões (`lib/painel/permissions.ts`) e componentes base. Sem novas dependências.
2. **Upgrade dos 4 esqueletos** da Fase 0 (`DataTable`, `FormField`, `ImageUpload`, `Modal`) para versões completas — esta fase é a primeira consumidora deles.
3. **Mutações via Server Actions** (`app/painel/<secao>/actions.ts`), cada uma revalidando sessão + `podeAcessar(role, secao)` no servidor. Mutações usam o service client quando precisarem contornar RLS de forma controlada, sempre após checar a permissão de painel.
4. **Upload de imagens:** bucket único `painel` no Supabase Storage (leitura pública, escrita restrita a papéis de painel). Banners e logos de destaque vão para lá.
5. **Empresas em Destaque** = vitrine de patrocinadas (logo + nome + descrição curta + link), cadastro manual, com render público para não nascer morta.
6. **Sem checkout/monetização** nesta fase: cadastro de banners e destaques é manual pela equipe.

---

## Banco de Dados

### Migration `010_featured_companies.sql`

```sql
CREATE TABLE public.featured_companies (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  logo_url    TEXT,
  link        TEXT,
  description TEXT,
  ordem       INTEGER NOT NULL DEFAULT 0,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  start_date  DATE,
  end_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.featured_companies ENABLE ROW LEVEL SECURITY;

-- Leitura pública (vitrine no site)
CREATE POLICY "featured_companies leitura publica"
  ON public.featured_companies FOR SELECT USING (true);

-- Escrita restrita a papéis de painel comercial
CREATE POLICY "featured_companies escrita painel"
  ON public.featured_companies FOR ALL
  USING (public.user_role() IN ('admin','comercial'))
  WITH CHECK (public.user_role() IN ('admin','comercial'));

CREATE INDEX idx_featured_companies_ativo ON public.featured_companies (ativo, ordem);
```

### Migration `011_storage_painel.sql`

Cria o bucket `painel` (público) e policies de escrita para papéis de painel:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('painel', 'painel', true)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública dos arquivos do bucket
CREATE POLICY "painel leitura publica"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'painel');

-- Upload/escrita restrita a papéis de painel
CREATE POLICY "painel escrita painel"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'painel' AND public.user_role() IN ('admin','comercial'));

CREATE POLICY "painel update painel"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'painel' AND public.user_role() IN ('admin','comercial'));

CREATE POLICY "painel delete painel"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'painel' AND public.user_role() IN ('admin','comercial'));
```

### `classifieds` — domínio de status

Adiciona `rejected` ao conjunto de status usados pela moderação. Não há constraint de status no banco hoje; o domínio passa a ser `pending | active | rejected` por convenção da aplicação (a moderação só grava esses valores).

### `types/database.ts`
- Adicionar a tabela `featured_companies` (Row/Insert/Update).

---

## Componentes (upgrade dos esqueletos da Fase 0)

| Componente | Entrega da Fase 1 |
|---|---|
| `DataTable.tsx` | Coluna de ações (slot `acoes` por linha), cabeçalho, estado vazio. Mantém a assinatura `Coluna<T>`/`dados` da Fase 0. |
| `FormField.tsx` | Wrapper de label + erro (já tem) usado junto a inputs nativos estilizados; sem libs externas. |
| `ImageUpload.tsx` | Upload real para o bucket `painel` (client: `supabase.storage.from('painel').upload(...)`), preview da imagem, botão remover, retorna a URL pública via `onChange`. |
| `Modal.tsx` | Fechar por ESC e clique no backdrop, trava de scroll do body, título + slot. |

---

## Seções

### 1. Publicidade — `/painel/publicidade`

- **Lista** (`DataTable`): miniatura da imagem, nome, posição, vigência (início–fim), impressões, cliques, status derivado das datas (`vigente | agendado | expirado`).
- **Form** (criar/editar, em `Modal` ou página `[id]`): `name`, imagem (`ImageUpload`), `link`, `position` (select fixo: top/sidebar/between/footer), `start_date`, `end_date`.
- `impressions`/`clicks` são **somente leitura**.
- **Ações:** criar, editar, excluir.
- **Server Actions:** `criarAd`, `atualizarAd`, `excluirAd` — revalidam `podeAcessar(role,'publicidade')`.

### 2. Classificados — `/painel/classificados`

- **Lista** com filtro por `status` (`pending | active | rejected`) e busca por título.
- **Moderação:** `aprovar` (`pending→active`), `rejeitar` (`→rejected`), `remover` (delete).
- **CRUD manual:** criar/editar com campos `title, description, price, category, city, state, phone, whatsapp, photos[] (ImageUpload múltiplo), status, expires_at`. Na criação manual, `user_id` = id do usuário de painel autenticado.
- **Server Actions:** `criarClassificado`, `atualizarClassificado`, `moderarClassificado(id, novoStatus)`, `excluirClassificado` — revalidam `podeAcessar(role,'classificados')`.

### 3. Empresas em Destaque — `/painel/destaques`

- **Lista** (`DataTable`): logo, nome, link, ordem, ativo, vigência.
- **Form:** `name`, `logo_url` (`ImageUpload`), `link`, `description` (curta), `ordem` (int), `ativo` (toggle), `start_date`, `end_date`.
- **Ações:** criar, editar, excluir, alternar ativo.
- **Server Actions:** `criarDestaque`, `atualizarDestaque`, `excluirDestaque` — revalidam `podeAcessar(role,'destaques')`.

#### Render público
- Componente `components/ui/EmpresasDestaque.tsx` (Server Component, espelha `BannerSlot`): busca `featured_companies` com `ativo=true` e vigência atual (mesma lógica de datas do `BannerSlot`), ordenadas por `ordem`. Render: faixa de cards com logo + nome + descrição curta, clicáveis (abre `link`).
- Incluído na home (`app/(public)/page.tsx`) em um ponto discreto. Se não houver registros vigentes, o componente retorna `null` (não ocupa espaço).

---

## Autorização (defesa em camadas)

1. **Middleware** (`proxy.ts`, já da Fase 0): barra `/painel` para quem não tem papel de painel.
2. **Páginas** (já da Fase 0 via guard de seção): `comercial`/`admin` acessam estas 3; demais papéis são redirecionados.
3. **Server Actions:** cada mutação revalida sessão + `podeAcessar(role, secao)` antes de gravar.
4. **RLS:** policies de `featured_companies` e do bucket `painel` exigem `user_role() IN ('admin','comercial')` para escrita.

---

## Critérios de Aceite (Fase 1)

- [x] Migrations `010` e `011` aplicadas; tabela `featured_companies` e bucket `painel` existem com as policies. *(aplicadas via MCP; verificado `to_regclass` + bucket)*
- [x] `tsc --noEmit` sem erros; build de produção sem erros. *(rotas `/painel/*` geradas)*
- [x] Caminho de dados da vitrine pública validado por smoke test (insert + query idêntica à do componente retorna o registro). *(registro de teste removido depois)*
- [ ] *(verificação manual no navegador)* **Publicidade:** criar banner com upload, posição e datas; aparece no slot do site e some ao expirar; editar/excluir.
- [ ] *(manual)* **Classificados:** lista com filtro por status; aprovar (`active`), rejeitar (`rejected`), criar manual, remover.
- [ ] *(manual)* **Empresas em Destaque:** cadastrar com logo; aparece na home; some ao desativar/expirar; editar/excluir.
- [ ] *(manual)* Upload grava no bucket `painel` e retorna URL pública utilizável.
- [ ] *(manual)* `editor` é barrado das 3 seções (herdado da Fase 0).

---

## Fora de Escopo (Fase 1)

- Guia Industrial, Vagas, Eventos, Colunistas + Artigos (Fase 2).
- Dashboard com cards/gráficos e Home builder drag-and-drop (Fase 3).
- Configurações e gestão de usuários (Fase 3).
- Checkout/monetização de banners e destaques (cadastro é manual pela equipe).
- Métricas avançadas de banners (relatórios); impressões/cliques permanecem somente leitura.
