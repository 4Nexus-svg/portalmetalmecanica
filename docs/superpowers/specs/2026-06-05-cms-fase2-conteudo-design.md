# Spec: CMS Portal MetalMecânica — Fase 2 (Conteúdo)

**Data:** 2026-06-05
**Status:** Aprovado
**Autor:** maxthomazi@gmail.com

---

## Contexto

Terceira fase do CMS. A [Fase 0](2026-06-05-cms-fase0-fundacao-design.md) entregou shell, auth e permissões; a [Fase 1](2026-06-05-cms-fase1-comercial-design.md) entregou as 3 seções comerciais e o kit de componentes completo (`DataTable`, `Modal`, `FormField`/`Input`/`Textarea`/`Select`, `ImageUpload`) + o guard de Server Action (`lib/painel/auth.ts`). A Fase 2 implementa o CRUD das **4 seções de conteúdo editorial**: Eventos, Colunistas (+ Artigos), Guia Industrial e Vagas — e expõe esse conteúdo no site.

**Acesso (matriz da Fase 0):**
- **Eventos, Guia, Vagas:** `admin` + `editor`.
- **Colunistas (+ Artigos):** `admin` + `editor` (gerenciam tudo) e `colunista` (só os próprios artigos).
- Artigos **não** são uma Secao nova — vivem dentro da seção `colunistas`, conforme a Fase 0.

### Estado atual do banco
- **`events`** (existe): `id, slug, title, description, type, date_start, date_end, city, state, organizer, image_url, is_auto, created_at`. Alimentada pelo pipeline (`is_auto=true`) e manualmente. Renderizada em `/eventos` e `/eventos/[slug]`.
- **`columnists`** (existe): `id, nome, slug, cargo, especialidade, bio, iniciais, cor, foto_url, ativo, profile_id, created_at`. `profile_id` (criado na Fase 0) liga o colunista ao usuário de painel. Listada em `/colunistas` (ainda sem página individual).
- **`posts`** (existe): notícias automáticas/manuais — **não** é tocada nesta fase (artigos de opinião terão tabela própria).
- **Não existem** tabelas para Artigos, Guia Industrial e Vagas — criadas aqui.

---

## Objetivo da Fase 2

Permitir que admin/editor gerenciem eventos, colunistas, guia de empresas e vagas pelo painel, e que cada colunista publique e edite seus próprios artigos. Todo esse conteúdo passa a aparecer no site (perfil de colunista, leitura de artigo, diretório do guia, listagem de vagas). Eventos e Colunistas, que já têm tabela, ganham a tela de gestão; Artigos, Guia e Vagas ganham tabela + tela + render público.

---

## Decisões de Design

1. **Reuso total** do kit de componentes e do guard `exigirSecao` da Fase 1. Sem novas dependências.
2. **Artigos = tabela própria `articles`** (não reusa `posts`), com página de leitura `/artigos/[slug]`, isolada do feed automático de notícias.
3. **Guia Industrial = diretório simples**: listagem filtrável por categoria, **sem** página de perfil individual por empresa nesta fase.
4. **Colunista self-service:** o usuário de papel `colunista` vê e edita **apenas** os artigos cujo `columnist_id` aponta para o registro de `columnists` com `profile_id = auth.uid()`. Admin/editor gerenciam todos os colunistas e artigos.
5. **Artigos sem paywall** nesta fase (diferente das notícias `is_exclusive`) — YAGNI.
6. **Mutações via Server Actions** que revalidam `exigirSecao` e gravam via service client (mesma convenção da Fase 1, incluindo o cast `(supabase.from("x") as any)` para insert/update). Para artigos de colunista, a action também valida a posse do `columnist_id`.

---

## Banco de Dados

### Migration `012_articles.sql`

```sql
CREATE TABLE IF NOT EXISTS public.articles (
  id           SERIAL PRIMARY KEY,
  title        TEXT NOT NULL,
  slug         TEXT NOT NULL UNIQUE,
  content      TEXT,
  excerpt      TEXT,
  cover_url    TEXT,
  columnist_id INTEGER NOT NULL REFERENCES public.columnists(id) ON DELETE CASCADE,
  published_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Leitura pública apenas de artigos publicados
CREATE POLICY "articles leitura publica"
  ON public.articles FOR SELECT
  USING (published_at IS NOT NULL);

-- Escrita: admin/editor (qualquer artigo) ou colunista dono do registro
CREATE POLICY "articles escrita painel"
  ON public.articles FOR ALL
  USING (
    public.user_role() IN ('admin','editor')
    OR EXISTS (SELECT 1 FROM public.columnists c WHERE c.id = articles.columnist_id AND c.profile_id = auth.uid())
  )
  WITH CHECK (
    public.user_role() IN ('admin','editor')
    OR EXISTS (SELECT 1 FROM public.columnists c WHERE c.id = articles.columnist_id AND c.profile_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_articles_columnist ON public.articles (columnist_id);
CREATE INDEX IF NOT EXISTS idx_articles_published ON public.articles (published_at);
```

### Migration `013_companies.sql`

```sql
CREATE TABLE IF NOT EXISTS public.companies (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  category    TEXT,
  city        TEXT,
  state       TEXT,
  phone       TEXT,
  site        TEXT,
  logo_url    TEXT,
  description TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "companies leitura publica"
  ON public.companies FOR SELECT USING (true);

CREATE POLICY "companies escrita painel"
  ON public.companies FOR ALL
  USING (public.user_role() IN ('admin','editor'))
  WITH CHECK (public.user_role() IN ('admin','editor'));

CREATE INDEX IF NOT EXISTS idx_companies_categoria ON public.companies (ativo, category);
```

### Migration `014_jobs.sql`

```sql
CREATE TABLE IF NOT EXISTS public.jobs (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  company       TEXT,
  city          TEXT,
  state         TEXT,
  type          TEXT,
  salary        TEXT,
  description   TEXT,
  link          TEXT,
  contact_email TEXT,
  ativo         BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at    DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs leitura publica"
  ON public.jobs FOR SELECT USING (true);

CREATE POLICY "jobs escrita painel"
  ON public.jobs FOR ALL
  USING (public.user_role() IN ('admin','editor'))
  WITH CHECK (public.user_role() IN ('admin','editor'));

CREATE INDEX IF NOT EXISTS idx_jobs_ativo ON public.jobs (ativo, expires_at);
```

### `types/database.ts`
Adicionar as tabelas `articles`, `companies`, `jobs` (Row/Insert/Update). `events` e `columnists` já estão tipadas.

---

## Painel — Telas de Gestão

Cada seção segue o padrão da Fase 1: `page.tsx` (server, guard `getPainelUser` + `podeAcessar` + busca) → client component com `DataTable` + `Modal`; mutações em `actions.ts` (`exigirSecao`).

### `/painel/eventos` (admin, editor)
- Lista: imagem, título, tipo, datas, cidade/UF, badge "Auto" quando `is_auto`.
- Form: `title`, `slug`, `description`, `type`, `date_start`, `date_end`, `city`, `state`, `organizer`, `image_url` (upload). Novos registros do painel entram com `is_auto=false`.
- Ações: criar, editar, excluir.

### `/painel/colunistas` (admin, editor, colunista)
Renderização condicional por papel:
- **admin/editor:**
  - Bloco "Colunistas": `DataTable` + form (`nome`, `slug`, `cargo`, `especialidade`, `bio`, `foto_url` upload, `ativo`, e seletor de usuário `profile_id` opcional para vincular ao login do colunista).
  - Bloco "Artigos": `DataTable` de todos os artigos + form (`title`, `slug`, `excerpt`, `content`, `cover_url` upload, `columnist_id` via seletor, `published_at` = publicar/rascunho).
- **colunista:**
  - Vê só "Meus Artigos": `DataTable` dos artigos do seu `columnist_id` + form (sem seletor de colunista — `columnist_id` fixo no seu registro). Pode publicar/despublicar e editar os próprios.
  - O `columnist_id` do colunista logado é resolvido por `columnists.profile_id = auth.uid()`. Se o login não estiver vinculado a nenhum colunista, mostra aviso "Seu usuário ainda não está vinculado a um colunista — peça ao administrador."

### `/painel/guia` (admin, editor)
- Lista: logo, nome, categoria, cidade/UF, ativo.
- Form: `name`, `category`, `city`, `state`, `phone`, `site`, `logo_url` (upload), `description`, `ativo`.

### `/painel/vagas` (admin, editor)
- Lista: título, empresa, cidade/UF, tipo, vigência, ativo.
- Form: `title`, `company`, `city`, `state`, `type`, `salary`, `description`, `link`, `contact_email`, `ativo`, `expires_at`.

---

## Render Público

- **`/colunistas/[slug]`** (novo): cabeçalho com foto/nome/cargo/bio do colunista + grid dos artigos publicados dele (link para `/artigos/[slug]`). A página `/colunistas` existente passa a linkar os cards para cá.
- **`/artigos/[slug]`** (novo): leitura do artigo — título, capa, autor (link para o colunista), data, conteúdo renderizado com a sanitização já usada em `/noticias/[slug]` (`lib/sanitize.ts`). Só artigos com `published_at` aparecem.
- **`/guia`** (novo): diretório de empresas (`ativo=true`), filtro client por categoria; cards com logo, nome, categoria, cidade, telefone e link para o site.
- **`/vagas`** (novo): listagem de vagas (`ativo=true` e não expiradas) — cards com título, empresa, local, tipo.
- **`/vagas/[id]`** (novo): detalhe da vaga — descrição completa, salário, e como se candidatar (`link` e/ou `contact_email`).
- **`/eventos`** e **`/eventos/[slug]`**: já existem — sem alteração.

---

## Autorização (defesa em camadas)

1. **Middleware** (`proxy.ts`, Fase 0): barra `/painel` para quem não tem papel de painel.
2. **Page guard** (Fase 1): cada `page.tsx` revalida `podeAcessar(role, secao)`.
3. **Server Actions:** `exigirSecao(secao)` antes de gravar.
4. **Posse de artigo (colunista):** as actions de artigo (`criarArtigo`/`atualizarArtigo`/`excluirArtigo`) verificam, quando o papel é `colunista`, que o `columnist_id` pertence ao colunista logado (`columnists.profile_id = auth.uid()`); admin/editor passam direto.
5. **RLS:** policies de `articles`, `companies`, `jobs` reforçam as regras no banco.

---

## Critérios de Aceite (Fase 2)

- [x] Migrations `012`, `013`, `014` aplicadas; tabelas `articles`, `companies`, `jobs` existem com RLS. *(aplicadas via MCP; `to_regclass` confirma as 3)*
- [x] `tsc --noEmit` sem erros; build de produção sem erros. *(39 páginas geradas; rotas `/painel/*` e públicas `/artigos`, `/colunistas/[slug]`, `/guia`, `/vagas`, `/vagas/[id]`)*
- [x] Caminhos de dados públicos validados por smoke test (insert + query idêntica retorna artigo publicado, empresa ativa e vaga vigente). *(registros de teste removidos)*
- [ ] *(verificação manual no navegador)* **Eventos:** criar/editar/excluir evento manual; aparece em `/eventos`; automáticos marcados "Auto".
- [ ] *(manual)* **Colunistas (admin/editor):** criar colunista + artigo; publicado aparece em `/artigos/[slug]` e `/colunistas/[slug]`.
- [ ] *(manual)* **Artigos (colunista):** `colunista` vê só os próprios e não acessa os de outro.
- [ ] *(manual)* **Guia:** cadastrar empresa; aparece em `/guia`; filtro por categoria funciona.
- [ ] *(manual)* **Vagas:** cadastrar vaga; aparece em `/vagas`; `/vagas/[id]` mostra contato; expirada/inativa some.
- [ ] *(manual)* Uploads gravam no bucket `painel`.

---

## Fora de Escopo (Fase 2)

- Página de perfil individual de empresa no Guia (`/guia/[slug]`).
- Paywall/exclusividade em artigos.
- Dashboard com cards/gráficos, Home builder, Configurações e Usuários (Fase 3).
- Alteração do pipeline automático de notícias/eventos (continua intocado).
- Importação em massa de empresas/vagas.
