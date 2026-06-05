# Spec: CMS Portal MetalMecânica — Fase 3 (Gestão)

**Data:** 2026-06-05
**Status:** Aprovado
**Autor:** maxthomazi@gmail.com

---

## Contexto

Fase final do CMS. As fases anteriores entregaram: [Fase 0](2026-06-05-cms-fase0-fundacao-design.md) (shell, auth, permissões), [Fase 1](2026-06-05-cms-fase1-comercial-design.md) (comercial + kit de componentes), [Fase 2](2026-06-05-cms-fase2-conteudo-design.md) (conteúdo editorial). A Fase 3 entrega a camada de **gestão**: Dashboard com métricas, Configurações do site, gestão de Usuários e o Home Builder (drag-and-drop) que controla a home pública.

**Acesso (matriz da Fase 0):**
- **Dashboard** (`/painel`): todos os papéis de painel.
- **Home** (`/painel/home`): `admin` + `editor`.
- **Configurações** e **Usuários**: `admin` apenas.

### Estado atual
- Reutiliza o kit (`DataTable`, `Modal`, `FormField`/`Input`/`Textarea`/`Select`, `ImageUpload`), o guard `lib/painel/auth.ts` (`getPainelUser`, `exigirSecao`) e a convenção de mutação (service client + cast `(supabase.from("x") as any)`).
- `recharts` já está nas dependências.
- A home (`app/(public)/page.tsx`) é hardcoded — será refatorada em blocos.
- Tabelas para métricas: `posts`, `subscriptions` (status, plan, current_period_end), `classifieds`, `companies`, `jobs`, `articles`, `ads`, `profiles`.
- **Não existem** tabelas de configuração nem de layout da home — criadas nesta fase.
- O `SUPABASE_SERVICE_ROLE_KEY` está configurado (local e Vercel), necessário para o convite de usuários.

---

## Objetivo da Fase 3

Dar ao admin uma visão gerencial (dashboard), controle das configurações do site, gestão de papéis/usuários e a capacidade de reorganizar a home pública por drag-and-drop. Ao final, o CMS está completo: todas as 11 seções do painel saem do estado placeholder/stub.

---

## Decisões de Design

1. **Reuso total** do kit e padrões das fases anteriores. Única dependência nova: **`@dnd-kit/core` + `@dnd-kit/sortable`** (drag-and-drop do Home Builder).
2. **Dashboard read-only** a partir das tabelas existentes; gráficos com `recharts`.
3. **Configurações** em tabela chave-valor `site_settings`, com consumo público mínimo (Footer + página de assinatura).
4. **Usuários:** troca de papel via update em `profiles`; convite via Supabase Admin API (`auth.admin.inviteUserByEmail`) com service role.
5. **Home Builder:** a home vira orientada a dados. Catálogo fixo de blocos em `home_blocks` (sem criar/remover tipos de bloco — só ordenar, ativar/desativar e dentro da coluna). Três colunas de layout: `full` (full-width no topo), `main` (coluna principal do grid 2-col), `sidebar`.

---

## Banco de Dados

### Migration `015_site_settings.sql`

```sql
CREATE TABLE IF NOT EXISTS public.site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_settings leitura publica"
  ON public.site_settings FOR SELECT USING (true);

CREATE POLICY "site_settings escrita admin"
  ON public.site_settings FOR ALL
  USING (public.user_role() = 'admin')
  WITH CHECK (public.user_role() = 'admin');

INSERT INTO public.site_settings (key, value) VALUES
  ('site_name', 'Portal MetalMecânica'),
  ('contact_email', ''),
  ('contact_phone', ''),
  ('social_instagram', ''),
  ('social_linkedin', ''),
  ('social_youtube', ''),
  ('subscription_price', '290')
ON CONFLICT (key) DO NOTHING;
```

### Migration `016_home_blocks.sql`

```sql
CREATE TABLE IF NOT EXISTS public.home_blocks (
  id     SERIAL PRIMARY KEY,
  key    TEXT NOT NULL UNIQUE,
  label  TEXT NOT NULL,
  coluna TEXT NOT NULL CHECK (coluna IN ('full','main','sidebar')),
  ordem  INTEGER NOT NULL DEFAULT 0,
  ativo  BOOLEAN NOT NULL DEFAULT TRUE
);

ALTER TABLE public.home_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "home_blocks leitura publica"
  ON public.home_blocks FOR SELECT USING (true);

CREATE POLICY "home_blocks escrita painel"
  ON public.home_blocks FOR ALL
  USING (public.user_role() IN ('admin','editor'))
  WITH CHECK (public.user_role() IN ('admin','editor'));

INSERT INTO public.home_blocks (key, label, coluna, ordem, ativo) VALUES
  ('manchete',          'Manchete principal',     'full',    0, true),
  ('faixa_colunistas',  'Faixa de colunistas',    'full',    1, true),
  ('empresas_destaque', 'Empresas em destaque',   'full',    2, true),
  ('grid_noticias',     'Grade de notícias',      'main',    0, true),
  ('banner_between',    'Banner entre seções',    'main',    1, true),
  ('mais_noticias',     'Mais notícias',          'main',    2, true),
  ('banner_sidebar',    'Banner lateral',         'sidebar', 0, true),
  ('mais_lidas',        'Mais lidas',             'sidebar', 1, true),
  ('newsletter',        'Newsletter',             'sidebar', 2, true),
  ('assinar',           'Assine',                 'sidebar', 3, true),
  ('canais_regionais',  'Canais regionais',       'sidebar', 4, true)
ON CONFLICT (key) DO NOTHING;
```

### `types/database.ts`
Adicionar `site_settings` e `home_blocks` (Row/Insert/Update).

---

## 1. Dashboard — `/painel` (substitui o placeholder)

`app/painel/page.tsx` passa a buscar contagens e séries e renderizar:
- **Cards de totais:** assinantes ativos (`subscriptions` status=active e `current_period_end >= now`), posts publicados, classificados pendentes, empresas no guia (ativas), vagas ativas, artigos publicados.
- **Gráficos (`recharts`, client component `DashboardCharts.tsx`):**
  - Linha/área: novos assinantes por mês (últimos 6 meses) a partir de `subscriptions.created_at`.
  - Barras: posts por categoria (top categorias de `posts`).
- **Atalhos por papel** (os cards-link atuais) permanecem abaixo.

As consultas de agregação rodam no server (`page.tsx`); os dados já agregados são passados ao `DashboardCharts`. Dashboard é read-only — sem mutações.

---

## 2. Configurações — `/painel/configuracoes` (admin)

- `app/painel/configuracoes/page.tsx` (server, guard admin) busca todas as linhas de `site_settings` e passa um objeto `Record<string,string>` ao client.
- `ConfiguracoesClient.tsx`: formulário com os campos (`site_name`, `contact_email`, `contact_phone`, `social_instagram`, `social_linkedin`, `social_youtube`, `subscription_price`). Botão "Salvar".
- `actions.ts`: `salvarConfiguracoes(valores: Record<string,string>)` — `exigirSecao('configuracoes')`, upsert linha-a-linha em `site_settings`. Revalida `/`, `/assinatura`.
- **Helper** `lib/settings.ts` → `getSettings(): Promise<Record<string,string>>` (server). Consumo público mínimo:
  - **Footer** (`components/layout/Footer.tsx`): usa `contact_email`, `contact_phone` e os links sociais quando preenchidos.
  - **Página `/assinatura`**: usa `subscription_price` no lugar do valor hardcoded, quando presente.

---

## 3. Usuários — `/painel/usuarios` (admin)

- `page.tsx` (guard admin) lista `profiles` (id, name, email, role).
- `UsuariosClient.tsx`:
  - Tabela com select inline de papel por linha (`admin|editor|comercial|colunista|user`) → `alterarPapel(userId, role)`.
  - Botão "Convidar usuário" → modal com campo de e-mail → `convidarUsuario(email)`.
- `actions.ts`:
  - `alterarPapel(userId, role)` — `exigirSecao('usuarios')` (e confirma papel admin), update em `profiles.role`. Impede o admin de rebaixar a si mesmo (guarda contra remoção acidental do próprio acesso).
  - `convidarUsuario(email)` — `exigirSecao('usuarios')`, usa o service client `auth.admin.inviteUserByEmail(email)`. O usuário criado entra com `role` default `user`; o admin promove depois pela própria tela.

---

## 4. Home Builder — `/painel/home` (admin, editor)

### Refator da home em blocos
Cada seção atual de `app/(public)/page.tsx` vira um componente em `components/home/`, recebendo os dados de que precisa por props:
- `full`: `Manchete` (destaque + secundárias), `FaixaColunistas` (já existe `ColunistasCarrossel`), `EmpresasDestaque` (já existe em `components/ui/`).
- `main`: `GridNoticias`, `BannerBetween` (usa `BannerSlot position="between"`), `MaisNoticias`.
- `sidebar`: `BannerSidebar` (`BannerSlot position="sidebar"`), `MaisLidas`, `Newsletter`, `Assinar`, `CanaisRegionais`.

`app/(public)/page.tsx`:
1. Busca os posts (como hoje) e os `home_blocks` ativos ordenados.
2. Monta um mapa `key → ReactNode` (cada bloco recebe os dados necessários).
3. Renderiza, em ordem: blocos `full` (full-width), depois o grid 2-colunas com blocos `main` (col principal) e `sidebar` (lateral). Cada lista respeita `ordem` e só inclui `ativo`.
4. Se a tabela estiver vazia/indisponível, cai num fallback com a ordem padrão (resiliência).

### Tela do builder
- `page.tsx` (guard admin/editor) busca `home_blocks` e passa ao client.
- `HomeBuilderClient.tsx`: três listas ordenáveis (`full`, `main`, `sidebar`) com **@dnd-kit** (`DndContext` + `SortableContext` por coluna; sem mover entre colunas). Cada item mostra o `label` e um toggle ativo/inativo. Botão "Salvar layout".
- `actions.ts`: `salvarLayout(blocos: { id: number; ordem: number; ativo: boolean }[])` — `exigirSecao('home')`, atualiza `ordem`/`ativo` de cada bloco; revalida `/`.

---

## Autorização

Mesmas camadas das fases anteriores (middleware → page guard `podeAcessar` → server action `exigirSecao` → RLS). Configurações/Usuários reforçam `role === 'admin'` na action além do guard de seção (a matriz já restringe a admin, mas a checagem dupla evita brechas).

---

## Dependências

Adicionar: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

---

## Critérios de Aceite (Fase 3)

- [ ] Migrations `015`, `016` aplicadas; `site_settings` e `home_blocks` existem com seeds e RLS.
- [ ] `tsc --noEmit` sem erros; build de produção sem erros.
- [ ] **Dashboard:** `/painel` mostra os cards de totais e os dois gráficos com dados reais.
- [ ] **Configurações:** admin altera nome do site/contato/redes/preço; Footer reflete contato+redes; `/assinatura` reflete o preço.
- [ ] **Usuários:** admin lista usuários, troca o papel de um usuário (persistido), e não consegue rebaixar a si mesmo; convite por e-mail dispara o fluxo de convite do Supabase.
- [ ] **Home Builder:** admin reordena e desativa blocos por drag-and-drop e salva; a home pública reflete a nova ordem/visibilidade; desativar um bloco o remove da home.
- [ ] A home pública continua renderizando corretamente (com fallback se `home_blocks` estiver indisponível).

---

## Fora de Escopo (Fase 3)

- Editar o conteúdo interno dos blocos pelo builder (só ordem/visibilidade).
- Criar/remover tipos de bloco da home (catálogo é fixo).
- Edição de e-mail/senha de usuários (apenas papel + convite).
- Métricas avançadas, filtros de período e exportação no dashboard.
- Mover blocos entre colunas no builder (reordenação é dentro da mesma coluna).
