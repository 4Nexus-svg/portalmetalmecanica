# Spec: CMS Portal MetalMecânica — Fase 0 (Fundação)

**Data:** 2026-06-05
**Status:** Aprovado
**Autor:** maxthomazi@gmail.com

---

## Contexto

O Portal MetalMecânica terá um painel administrativo (CMS) para gerenciar conteúdo **manual e comercial** — o conteúdo automático (notícias por IA/RSS/APIs) NÃO é gerenciado por aqui. O CMS completo tem 11 seções e 4 perfis de acesso, sendo grande demais para um único ciclo de implementação.

### Decomposição em fases

| Fase | Entrega |
|---|---|
| **0 — Fundação** (este spec) | Shell do painel, auth de 4 perfis, modelo de permissões, perfis expandidos no banco, componentes base, stubs navegáveis de todas as seções. |
| **1 — Comercial** | Publicidade (banners), Classificados, Empresas em Destaque. |
| **2 — Conteúdo** | Guia Industrial, Vagas, Eventos, Colunistas + Artigos. |
| **3 — Gestão** | Dashboard executivo (cards/gráficos), Home builder (drag-and-drop), Configurações, Usuários. |

Cada fase tem seu próprio spec → plano → implementação.

---

## Objetivo da Fase 0

Entregar a **fundação navegável e protegida** do CMS: um usuário com papel de painel faz login, entra em `/painel`, vê a sidebar com apenas as seções que pode acessar, navega entre elas (todas funcionando como stubs "Em construção"), e é barrado (middleware + layout) de qualquer seção fora da sua permissão. Tudo testável end-to-end antes de qualquer CRUD real.

---

## Decisões de Design

1. **Stack:** Tailwind puro (sem Shadcn/UI), seguindo a identidade do site público (navy `#1A2B4A` + dourado `#C9A84C`). Sem novas dependências.
2. **Rota:** Novo namespace `/painel/*`. O `/admin` antigo (notícias) permanece intocado.
3. **Perfis:** `admin`, `editor`, `comercial`, `colunista` acessam o painel. `user` (assinante comum) não acessa.
4. **Dashboard Fase 0:** placeholder (landing por perfil com atalhos). Cards/gráficos reais ficam para a Fase 3.
5. **Componentes:** kit base em `components/painel/`. Fase 0 entrega o mínimo para o shell; `DataTable`/`FormField`/`ImageUpload`/`Modal` ganham versão completa na Fase 1.

---

## Matriz de Acesso

| Perfil | Seções acessíveis |
|---|---|
| **admin** | Todas (11) |
| **editor** | dashboard, guia, vagas, eventos, colunistas, destaques, home |
| **comercial** | dashboard, publicidade, classificados, destaques |
| **colunista** | dashboard, colunistas (na Fase 2, RLS restringe aos próprios artigos) |
| **user** | nenhuma — redirecionado para `/` |

---

## Banco de Dados

Migration `supabase/migrations/009_cms_roles.sql`:

```sql
-- Expande os papéis de usuário
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'editor', 'comercial', 'colunista', 'user'));

-- Vincula colunista do painel ao registro público em columnists (Fase 2)
ALTER TABLE public.columnists ADD COLUMN IF NOT EXISTS profile_id UUID
  REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Helper de papel (base das RLS das fases seguintes)
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;
```

Default de `role` continua `'user'`. Nenhuma tabela de conteúdo nova nesta fase.

`types/database.ts`: atualizar o tipo de `profiles.role` para `'admin' | 'editor' | 'comercial' | 'colunista' | 'user'` e adicionar `profile_id` em `columnists`.

---

## Modelo de Permissões

`lib/painel/permissions.ts` — fonte única de verdade:

```typescript
export type Role = 'admin' | 'editor' | 'comercial' | 'colunista';

export type Secao =
  | 'dashboard' | 'publicidade' | 'classificados' | 'guia'
  | 'vagas' | 'eventos' | 'colunistas' | 'destaques'
  | 'home' | 'configuracoes' | 'usuarios';

const ACESSO: Record<Role, Secao[]> = {
  admin:     ['dashboard','publicidade','classificados','guia','vagas','eventos','colunistas','destaques','home','configuracoes','usuarios'],
  editor:    ['dashboard','guia','vagas','eventos','colunistas','destaques','home'],
  comercial: ['dashboard','publicidade','classificados','destaques'],
  colunista: ['dashboard','colunistas'],
};

export function podeAcessar(role: Role, secao: Secao): boolean {
  return ACESSO[role]?.includes(secao) ?? false;
}

export function secoesDisponiveis(role: Role): Secao[] {
  return ACESSO[role] ?? [];
}
```

Metadados das seções (label, ícone lucide, rota) ficam num mapa `SECOES_META` no mesmo arquivo, consumido pela sidebar.

---

## Estrutura de Rotas

```
app/painel/
  layout.tsx              ← shell: valida sessão+role, monta sidebar+header
  page.tsx                ← dashboard placeholder (landing por perfil)
  publicidade/page.tsx    ← stub
  classificados/page.tsx  ← stub
  guia/page.tsx           ← stub
  vagas/page.tsx          ← stub
  eventos/page.tsx        ← stub
  colunistas/page.tsx     ← stub
  destaques/page.tsx      ← stub
  home/page.tsx           ← stub
  configuracoes/page.tsx  ← stub
  usuarios/page.tsx       ← stub
```

### `layout.tsx` (Server Component)

1. Busca `user` + `profile.role` via Supabase server client.
2. Sem `user` → redirect `/login?next=/painel`.
3. `role === 'user'` ou inválido → redirect `/`.
4. Renderiza `<Sidebar role={role} />` + `<PainelHeader user={...} role={role} />` + `{children}`.

### `page.tsx` (Dashboard placeholder)

Landing simples: "Bem-vindo, {nome}" + grid de atalhos (cards-link) para as seções que o papel acessa via `secoesDisponiveis(role)`.

### Páginas de seção (stubs)

Cada `[secao]/page.tsx`:
1. Revalida permissão com `podeAcessar(role, secao)`; se negado → redirect `/painel`.
2. Renderiza `<SecaoHeader>` + `<StubSecao fase="X" />`.

---

## Componentes (`components/painel/`)

| Componente | Fase 0 entrega | Responsabilidade |
|---|---|---|
| `Sidebar.tsx` | completo | Navegação client; lista seções do papel; marca ativo |
| `PainelHeader.tsx` | completo | Topo: nome+papel, "Sair", "Ver site" |
| `SecaoHeader.tsx` | completo | Título + descrição + slot de ação |
| `StubSecao.tsx` | completo | Placeholder "Em construção — Fase X" |
| `Badge.tsx` | completo | Status colorido (reusável) |
| `EmptyState.tsx` | completo | Estado vazio |
| `DataTable.tsx` | esqueleto | Versão completa na Fase 1 |
| `FormField.tsx` | esqueleto | Versão completa na Fase 1 |
| `ImageUpload.tsx` | esqueleto | Versão completa na Fase 1 (Supabase Storage, bucket `painel`) |
| `Modal.tsx` | esqueleto | Versão completa na Fase 1 |

"Esqueleto" = assinatura de props definida + render mínimo, para o shell compilar; lógica real na Fase 1.

---

## Autenticação e Middleware

`proxy.ts` ganha um bloco para `/painel` (espelhando o de `/admin`):

```typescript
if (pathname.startsWith("/painel")) {
  if (!user) return NextResponse.redirect(new URL("/login?next=" + pathname, request.url));
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  const rolesPainel = ['admin','editor','comercial','colunista'];
  if (!rolesPainel.includes(profile?.role ?? '')) {
    return NextResponse.redirect(new URL("/", request.url));
  }
}
```

**Defesa em duas camadas:**
1. **Middleware** — barra `/painel/*` para quem não tem papel de painel.
2. **`layout.tsx` + `podeAcessar()`** — barra seção específica fora da permissão do papel, redirecionando ao dashboard.

**Login:** tela `/login` existente inalterada; já suporta `?next=`. Perfil de painel sem `next` cai em `/painel`.
**Logout:** limpa sessão Supabase, volta para `/`.

---

## Critérios de Aceite (Fase 0)

- [x] Migration `009` aplicada; `profiles.role` aceita os 5 valores. *(verificado no banco: constraint lista admin/editor/comercial/colunista/user)*
- [x] `tsc --noEmit` sem erros.
- [x] Build de produção sem erros. *(11 rotas `/painel*` geradas)*
- [x] Guards de código implementados (middleware `proxy.ts` + `layout.tsx`/`_stub` com `podeAcessar`); lógica de permissões pura e type-checked: admin 11, editor 7, comercial 4, colunista 2.
- [ ] *(verificação ao vivo — pendente de contas de teste)* Usuário não logado em `/painel` → redirecionado ao login.
- [ ] *(ao vivo)* Usuário `user` logado em `/painel` → redirecionado a `/`.
- [ ] *(ao vivo)* Admin vê 11 seções; Comercial 4; Editor 7; Colunista 2 na sidebar.
- [ ] *(ao vivo)* Comercial digitando `/painel/usuarios` na URL → redirecionado ao dashboard.
- [ ] *(ao vivo)* Todas as seções abrem com o stub "Em construção".
- [ ] *(ao vivo)* Header mostra nome+papel; "Sair" encerra sessão; "Ver site" leva à home.

---

## Fora de Escopo (Fase 0)

- Qualquer CRUD real (vem nas fases 1–3).
- Dashboard com cards/gráficos (Fase 3).
- Home builder drag-and-drop (Fase 3).
- Configurações e gestão de usuários funcionais (Fase 3).
- Tabelas `companies`, `jobs`, `articles`, `featured_companies` (criadas nas fases que as usam).
