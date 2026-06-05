# CMS Fase 0 (Fundação) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a fundação navegável e protegida do CMS em `/painel` — auth de 4 perfis, modelo de permissões, shell (sidebar + header), dashboard placeholder e stubs de todas as 11 seções, tudo barrado por middleware + layout.

**Architecture:** Novo namespace de rotas `app/painel/*` (Server Components para guard + Client Components para sidebar/header interativos). Fonte única de permissões em `lib/painel/permissions.ts`. Defesa em duas camadas: middleware (`proxy.ts`) barra `/painel` para quem não tem papel de painel; `layout.tsx` + `podeAcessar()` barram seções específicas. O `/admin` antigo permanece intocado.

**Tech Stack:** Next.js 16 (App Router), Supabase SSR (`@supabase/ssr`), TypeScript strict, Tailwind CSS 3.4 (sem Shadcn), lucide-react. Identidade: navy `#1A2B4A` + dourado `#C9A84C`.

> **Nota sobre verificação:** o projeto **não tem framework de testes** (zero cobertura, decisão registrada no backlog). Esta fase não introduz Jest/RTL (YAGNI — fora do escopo da spec). Os portões de verificação são `npm run type-check` (`tsc --noEmit`), `npm run build` e checagens manuais no navegador contra os Critérios de Aceite da spec. As funções de `permissions.ts` são puras e seu comportamento é verificado pelas contagens de seções por perfil na Task 11.

> **Referência:** spec aprovada em `docs/superpowers/specs/2026-06-05-cms-fase0-fundacao-design.md`.

---

## Estrutura de Arquivos

**Criar:**
- `supabase/migrations/009_cms_roles.sql` — expande `profiles.role`, adiciona `columnists.profile_id`, cria `user_role()`.
- `lib/painel/permissions.ts` — tipos `Role`/`Secao`, matriz `ACESSO`, `podeAcessar`, `secoesDisponiveis`, `SECOES_META`.
- `components/painel/Badge.tsx` — status colorido reusável.
- `components/painel/EmptyState.tsx` — estado vazio.
- `components/painel/StubSecao.tsx` — placeholder "Em construção — Fase X".
- `components/painel/SecaoHeader.tsx` — título + descrição + slot de ação.
- `components/painel/Sidebar.tsx` — navegação client.
- `components/painel/PainelHeader.tsx` — topo com nome+papel, "Ver site", "Sair".
- `components/painel/DataTable.tsx` — esqueleto (Fase 1).
- `components/painel/FormField.tsx` — esqueleto (Fase 1).
- `components/painel/ImageUpload.tsx` — esqueleto (Fase 1).
- `components/painel/Modal.tsx` — esqueleto (Fase 1).
- `app/painel/layout.tsx` — shell + guard de sessão/role.
- `app/painel/page.tsx` — dashboard placeholder.
- `app/painel/publicidade/page.tsx` ... `app/painel/usuarios/page.tsx` — 11 stubs de seção.

**Modificar:**
- `types/database.ts` — tipo de `profiles.role` (5 valores) + `profile_id` em `columnists`.
- `proxy.ts` — bloco de guard para `/painel`.

---

### Task 1: Migration de papéis + tipos do banco

**Files:**
- Create: `supabase/migrations/009_cms_roles.sql`
- Modify: `types/database.ts:5-7` (profiles), `types/database.ts:40-42` (columnists)

- [ ] **Step 1: Criar a migration**

Create `supabase/migrations/009_cms_roles.sql`:

```sql
-- 009_cms_roles.sql — Fase 0 do CMS: expande papéis de usuário

-- Expande os papéis de usuário aceitos
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'editor', 'comercial', 'colunista', 'user'));

-- Vincula colunista do painel ao registro público em columnists (usado na Fase 2)
ALTER TABLE public.columnists ADD COLUMN IF NOT EXISTS profile_id UUID
  REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Helper de papel (base das RLS das fases seguintes)
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;
```

- [ ] **Step 2: Aplicar a migration no Supabase**

Aplicar via o MCP do Supabase (ferramenta de apply migration / execute SQL) ou colando o SQL no SQL Editor do projeto Supabase. Default de `role` continua `'user'`.

Verificar que aplicou:
```sql
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint WHERE conname = 'profiles_role_check';
```
Expected: o `CHECK` lista os 5 valores (`admin`, `editor`, `comercial`, `colunista`, `user`).

- [ ] **Step 3: Atualizar o tipo de `profiles.role` em `types/database.ts`**

Em `types/database.ts`, substituir as 3 linhas de `profiles` (linhas 5-7) por:

```typescript
        Row: { id: string; email: string | null; name: string | null; cnpj: string | null; role: "admin" | "editor" | "comercial" | "colunista" | "user"; created_at: string };
        Insert: { id: string; email?: string | null; name?: string | null; cnpj?: string | null; role?: "admin" | "editor" | "comercial" | "colunista" | "user" };
        Update: { email?: string | null; name?: string | null; cnpj?: string | null; role?: "admin" | "editor" | "comercial" | "colunista" | "user" };
```

- [ ] **Step 4: Adicionar `profile_id` ao tipo `columnists`**

Em `types/database.ts`, substituir as 3 linhas de `columnists` (linhas 40-42) por (adiciona `profile_id` em Row/Insert/Update):

```typescript
        Row: { id: number; nome: string; slug: string; cargo: string | null; especialidade: string | null; bio: string | null; iniciais: string | null; cor: string | null; foto_url: string | null; ativo: boolean; profile_id: string | null; created_at: string };
        Insert: { nome: string; slug: string; cargo?: string | null; especialidade?: string | null; bio?: string | null; iniciais?: string | null; cor?: string | null; foto_url?: string | null; ativo?: boolean; profile_id?: string | null };
        Update: { nome?: string; slug?: string; cargo?: string | null; especialidade?: string | null; bio?: string | null; iniciais?: string | null; cor?: string | null; foto_url?: string | null; ativo?: boolean; profile_id?: string | null };
```

- [ ] **Step 5: Verificar type-check**

Run: `npm run type-check`
Expected: PASS (sem erros). Nada consome ainda os novos valores, então não deve quebrar.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/009_cms_roles.sql types/database.ts
git commit -m "feat(painel): migration 009 expande papeis de usuario e tipos do banco"
```

---

### Task 2: Modelo de permissões

**Files:**
- Create: `lib/painel/permissions.ts`

- [ ] **Step 1: Criar o módulo de permissões**

Create `lib/painel/permissions.ts`:

```typescript
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Megaphone, Tag, BookOpen, Briefcase,
  CalendarDays, PenLine, Star, Home, Settings, Users,
} from "lucide-react";

export type Role = "admin" | "editor" | "comercial" | "colunista";

export type Secao =
  | "dashboard" | "publicidade" | "classificados" | "guia"
  | "vagas" | "eventos" | "colunistas" | "destaques"
  | "home" | "configuracoes" | "usuarios";

const ACESSO: Record<Role, Secao[]> = {
  admin:     ["dashboard", "publicidade", "classificados", "guia", "vagas", "eventos", "colunistas", "destaques", "home", "configuracoes", "usuarios"],
  editor:    ["dashboard", "guia", "vagas", "eventos", "colunistas", "destaques", "home"],
  comercial: ["dashboard", "publicidade", "classificados", "destaques"],
  colunista: ["dashboard", "colunistas"],
};

export function podeAcessar(role: Role, secao: Secao): boolean {
  return ACESSO[role]?.includes(secao) ?? false;
}

export function secoesDisponiveis(role: Role): Secao[] {
  return ACESSO[role] ?? [];
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  editor: "Editor",
  comercial: "Comercial",
  colunista: "Colunista",
};

export interface SecaoMeta {
  label: string;
  rota: string;
  icone: LucideIcon;
  fase: number; // fase em que ganha CRUD real
}

export const SECOES_META: Record<Secao, SecaoMeta> = {
  dashboard:     { label: "Dashboard",      rota: "/painel",                icone: LayoutDashboard, fase: 3 },
  publicidade:   { label: "Publicidade",    rota: "/painel/publicidade",    icone: Megaphone,       fase: 1 },
  classificados: { label: "Classificados",  rota: "/painel/classificados",  icone: Tag,             fase: 1 },
  destaques:     { label: "Destaques",      rota: "/painel/destaques",      icone: Star,            fase: 1 },
  guia:          { label: "Guia Industrial", rota: "/painel/guia",          icone: BookOpen,        fase: 2 },
  vagas:         { label: "Vagas",          rota: "/painel/vagas",          icone: Briefcase,       fase: 2 },
  eventos:       { label: "Eventos",        rota: "/painel/eventos",        icone: CalendarDays,    fase: 2 },
  colunistas:    { label: "Colunistas",     rota: "/painel/colunistas",     icone: PenLine,         fase: 2 },
  home:          { label: "Home",           rota: "/painel/home",           icone: Home,            fase: 3 },
  configuracoes: { label: "Configurações",  rota: "/painel/configuracoes",  icone: Settings,        fase: 3 },
  usuarios:      { label: "Usuários",       rota: "/painel/usuarios",       icone: Users,           fase: 3 },
};

/** Converte o role do banco (5 valores) num Role de painel, ou null se não acessa o painel. */
export function rolePainel(dbRole: string | null | undefined): Role | null {
  if (dbRole === "admin" || dbRole === "editor" || dbRole === "comercial" || dbRole === "colunista") {
    return dbRole;
  }
  return null;
}
```

- [ ] **Step 2: Verificar type-check**

Run: `npm run type-check`
Expected: PASS. Confirma que todos os ícones lucide importados existem e os tipos fecham.

- [ ] **Step 3: Commit**

```bash
git add lib/painel/permissions.ts
git commit -m "feat(painel): modelo de permissoes e metadados de secoes"
```

---

### Task 3: Componentes base (completos)

**Files:**
- Create: `components/painel/Badge.tsx`
- Create: `components/painel/EmptyState.tsx`
- Create: `components/painel/StubSecao.tsx`
- Create: `components/painel/SecaoHeader.tsx`

- [ ] **Step 1: Criar `Badge.tsx`**

Create `components/painel/Badge.tsx`:

```tsx
type Variant = "neutro" | "sucesso" | "alerta" | "perigo" | "info";

const ESTILOS: Record<Variant, string> = {
  neutro:  "bg-gray-100 text-gray-600",
  sucesso: "bg-green-100 text-green-700",
  alerta:  "bg-amber-100 text-amber-700",
  perigo:  "bg-red-100 text-red-700",
  info:    "bg-blue-100 text-blue-700",
};

export default function Badge({
  children,
  variant = "neutro",
}: {
  children: React.ReactNode;
  variant?: Variant;
}) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ESTILOS[variant]}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Criar `EmptyState.tsx`**

Create `components/painel/EmptyState.tsx`:

```tsx
import type { LucideIcon } from "lucide-react";

export default function EmptyState({
  icon: Icon,
  titulo,
  descricao,
  acao,
}: {
  icon?: LucideIcon;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16">
      {Icon && <Icon className="w-10 h-10 text-gray-300 mb-4" />}
      <p className="text-gray-700 font-medium">{titulo}</p>
      {descricao && <p className="text-sm text-gray-400 mt-1 max-w-sm">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Criar `StubSecao.tsx`**

Create `components/painel/StubSecao.tsx`:

```tsx
import { Construction } from "lucide-react";
import EmptyState from "./EmptyState";

export default function StubSecao({ fase }: { fase: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100">
      <EmptyState
        icon={Construction}
        titulo="Em construção"
        descricao={`Esta seção ganha funcionalidade completa na Fase ${fase} do CMS.`}
      />
    </div>
  );
}
```

- [ ] **Step 4: Criar `SecaoHeader.tsx`**

Create `components/painel/SecaoHeader.tsx`:

```tsx
export default function SecaoHeader({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A2B4A]">{titulo}</h1>
        {descricao && <p className="text-sm text-gray-500 mt-1">{descricao}</p>}
      </div>
      {acao && <div className="shrink-0">{acao}</div>}
    </div>
  );
}
```

- [ ] **Step 5: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/painel/Badge.tsx components/painel/EmptyState.tsx components/painel/StubSecao.tsx components/painel/SecaoHeader.tsx
git commit -m "feat(painel): componentes base Badge, EmptyState, StubSecao, SecaoHeader"
```

---

### Task 4: Componentes esqueleto (Fase 1)

**Files:**
- Create: `components/painel/DataTable.tsx`
- Create: `components/painel/FormField.tsx`
- Create: `components/painel/ImageUpload.tsx`
- Create: `components/painel/Modal.tsx`

> "Esqueleto" = assinatura de props definida + render mínimo, para o shell compilar. Lógica real vem na Fase 1.

- [ ] **Step 1: Criar `DataTable.tsx`**

Create `components/painel/DataTable.tsx`:

```tsx
export interface Coluna<T> {
  chave: keyof T | string;
  titulo: string;
  render?: (linha: T) => React.ReactNode;
}

export default function DataTable<T extends { id: string | number }>({
  colunas,
  dados,
  vazio = "Nenhum registro.",
}: {
  colunas: Coluna<T>[];
  dados: T[];
  vazio?: string;
}) {
  // Versão completa (ordenação, paginação, ações) na Fase 1.
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
          <tr>
            {colunas.map((c) => (
              <th key={String(c.chave)} className="text-left px-6 py-3">{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {dados.map((linha) => (
            <tr key={linha.id} className="hover:bg-gray-50 transition-colors">
              {colunas.map((c) => (
                <td key={String(c.chave)} className="px-6 py-4 text-gray-700">
                  {c.render ? c.render(linha) : String((linha as Record<string, unknown>)[String(c.chave)] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {dados.length === 0 && (
        <div className="px-6 py-12 text-center text-gray-400">{vazio}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Criar `FormField.tsx`**

Create `components/painel/FormField.tsx`:

```tsx
export default function FormField({
  label,
  htmlFor,
  erro,
  children,
}: {
  label: string;
  htmlFor?: string;
  erro?: string;
  children: React.ReactNode;
}) {
  // Versão completa (variações de input, máscara, validação) na Fase 1.
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
      {erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Criar `ImageUpload.tsx`**

Create `components/painel/ImageUpload.tsx`:

```tsx
"use client";

export default function ImageUpload({
  valor,
  onChange,
  label = "Imagem",
}: {
  valor?: string | null;
  onChange?: (url: string | null) => void;
  label?: string;
}) {
  // Versão completa (upload para Supabase Storage, bucket `painel`) na Fase 1.
  // `onChange` reservado para a integração de upload da Fase 1.
  void onChange;
  return (
    <div className="mb-4">
      <p className="block text-sm font-medium text-gray-700 mb-1">{label}</p>
      <div className="flex items-center justify-center h-32 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400">
        {valor ? "Imagem definida" : "Upload disponível na Fase 1"}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Criar `Modal.tsx`**

Create `components/painel/Modal.tsx`:

```tsx
"use client";

export default function Modal({
  aberto,
  titulo,
  onFechar,
  children,
}: {
  aberto: boolean;
  titulo?: string;
  onFechar?: () => void;
  children: React.ReactNode;
}) {
  // Versão completa (foco, ESC, animação) na Fase 1.
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        {titulo && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-[#1A2B4A]">{titulo}</h2>
            <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
              ×
            </button>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/painel/DataTable.tsx components/painel/FormField.tsx components/painel/ImageUpload.tsx components/painel/Modal.tsx
git commit -m "feat(painel): esqueletos de DataTable, FormField, ImageUpload, Modal (Fase 1)"
```

---

### Task 5: Sidebar (navegação client)

**Files:**
- Create: `components/painel/Sidebar.tsx`

- [ ] **Step 1: Criar `Sidebar.tsx`**

Create `components/painel/Sidebar.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { secoesDisponiveis, SECOES_META, type Role } from "@/lib/painel/permissions";

export default function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const secoes = secoesDisponiveis(role);

  return (
    <aside className="w-60 shrink-0 bg-[#1A2B4A] text-white min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <span className="font-bold text-lg">Portal</span>
        <span className="text-[#C9A84C] font-bold text-lg"> MetalMecânica</span>
        <p className="text-xs text-white/50 mt-0.5">Painel de Gestão</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {secoes.map((secao) => {
          const meta = SECOES_META[secao];
          const Icone = meta.icone;
          const ativo =
            secao === "dashboard"
              ? pathname === "/painel"
              : pathname === meta.rota || pathname.startsWith(meta.rota + "/");
          return (
            <Link
              key={secao}
              href={meta.rota}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                ativo
                  ? "bg-[#C9A84C] text-[#1A2B4A] font-semibold"
                  : "text-white/80 hover:bg-white/10"
              }`}
            >
              <Icone className="w-4 h-4 shrink-0" />
              {meta.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/painel/Sidebar.tsx
git commit -m "feat(painel): Sidebar com secoes filtradas por papel"
```

---

### Task 6: PainelHeader (topo + logout)

**Files:**
- Create: `components/painel/PainelHeader.tsx`

- [ ] **Step 1: Criar `PainelHeader.tsx`**

Create `components/painel/PainelHeader.tsx`. É client component porque o logout chama o Supabase no browser.

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABEL, type Role } from "@/lib/painel/permissions";

export default function PainelHeader({
  nome,
  role,
}: {
  nome: string;
  role: Role;
}) {
  const router = useRouter();

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-10">
      <div>
        <p className="text-sm font-semibold text-[#1A2B4A]">{nome}</p>
        <p className="text-xs text-gray-400">{ROLE_LABEL[role]}</p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1A2B4A] transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Ver site
        </Link>
        <button
          onClick={sair}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verificar type-check**

Run: `npm run type-check`
Expected: PASS. Confirma que `createClient` de `@/lib/supabase/client` existe e tem `auth.signOut`.

- [ ] **Step 3: Commit**

```bash
git add components/painel/PainelHeader.tsx
git commit -m "feat(painel): PainelHeader com nome, papel, ver site e logout"
```

---

### Task 7: Layout do painel (shell + guard)

**Files:**
- Create: `app/painel/layout.tsx`

- [ ] **Step 1: Criar `layout.tsx`**

Create `app/painel/layout.tsx`. Server Component: valida sessão + role e monta o shell.

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rolePainel } from "@/lib/painel/permissions";
import Sidebar from "@/components/painel/Sidebar";
import PainelHeader from "@/components/painel/PainelHeader";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/painel");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle() as { data: Profile | null; error: unknown };

  const role = rolePainel(profile?.role);
  if (!role) redirect("/");

  const nome = profile?.name ?? user.email ?? "Usuário";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role={role} />
      <div className="flex-1 flex flex-col min-w-0">
        <PainelHeader nome={nome} role={role} />
        <main className="flex-1 px-6 py-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/painel/layout.tsx
git commit -m "feat(painel): layout shell com guard de sessao e papel"
```

---

### Task 8: Dashboard placeholder

**Files:**
- Create: `app/painel/page.tsx`

- [ ] **Step 1: Criar a página de dashboard**

Create `app/painel/page.tsx`. Landing por perfil: saudação + grid de atalhos para as seções do papel (exclui o próprio "dashboard").

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rolePainel, secoesDisponiveis, SECOES_META } from "@/lib/painel/permissions";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function PainelDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/painel");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle() as { data: Profile | null; error: unknown };

  const role = rolePainel(profile?.role);
  if (!role) redirect("/");

  const nome = profile?.name ?? user.email ?? "Usuário";
  const atalhos = secoesDisponiveis(role).filter((s) => s !== "dashboard");

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A2B4A]">Bem-vindo, {nome}</h1>
      <p className="text-sm text-gray-500 mt-1">Selecione uma área para gerenciar.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {atalhos.map((secao) => {
          const meta = SECOES_META[secao];
          const Icone = meta.icone;
          return (
            <Link
              key={secao}
              href={meta.rota}
              className="group bg-white rounded-xl border border-gray-100 p-5 hover:border-[#C9A84C] hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-[#1A2B4A]/5 flex items-center justify-center mb-3 group-hover:bg-[#C9A84C]/15 transition-colors">
                <Icone className="w-5 h-5 text-[#1A2B4A]" />
              </div>
              <p className="font-semibold text-[#1A2B4A]">{meta.label}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/painel/page.tsx
git commit -m "feat(painel): dashboard placeholder com atalhos por papel"
```

---

### Task 9: Páginas de seção (11 stubs com guard)

**Files:**
- Create: `app/painel/publicidade/page.tsx`
- Create: `app/painel/classificados/page.tsx`
- Create: `app/painel/destaques/page.tsx`
- Create: `app/painel/guia/page.tsx`
- Create: `app/painel/vagas/page.tsx`
- Create: `app/painel/eventos/page.tsx`
- Create: `app/painel/colunistas/page.tsx`
- Create: `app/painel/home/page.tsx`
- Create: `app/painel/configuracoes/page.tsx`
- Create: `app/painel/usuarios/page.tsx`

> São 10 stubs (a 11ª seção, `dashboard`, é a `page.tsx` da Task 8). Cada um revalida `podeAcessar(role, secao)` — se negado, redireciona ao dashboard.

- [ ] **Step 1: Criar um helper compartilhado de stub**

Create `app/painel/_stub.tsx` (prefixo `_` → não vira rota):

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rolePainel, podeAcessar, SECOES_META, type Secao } from "@/lib/painel/permissions";
import SecaoHeader from "@/components/painel/SecaoHeader";
import StubSecao from "@/components/painel/StubSecao";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const DESCRICAO: Record<Secao, string> = {
  dashboard:     "Visão geral do painel.",
  publicidade:   "Banners e campanhas publicitárias do portal.",
  classificados: "Anúncios classificados de máquinas, equipamentos e serviços.",
  destaques:     "Empresas em destaque exibidas no portal.",
  guia:          "Guia industrial de empresas e fornecedores.",
  vagas:         "Vagas de emprego do setor metalmecânico.",
  eventos:       "Feiras, congressos e eventos do setor.",
  colunistas:    "Colunistas e seus artigos de opinião.",
  home:          "Montagem e organização da home do portal.",
  configuracoes: "Configurações gerais do portal.",
  usuarios:      "Usuários e papéis de acesso ao painel.",
};

export default async function StubPage({ secao }: { secao: Secao }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/painel");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle() as { data: Profile | null; error: unknown };

  const role = rolePainel(profile?.role);
  if (!role) redirect("/");
  if (!podeAcessar(role, secao)) redirect("/painel");

  const meta = SECOES_META[secao];
  return (
    <div>
      <SecaoHeader titulo={meta.label} descricao={DESCRICAO[secao]} />
      <StubSecao fase={meta.fase} />
    </div>
  );
}
```

- [ ] **Step 2: Criar os 10 arquivos de página**

Cada página é uma chamada do helper com a `secao` correta. Exemplo — `app/painel/publicidade/page.tsx`:

```tsx
import StubPage from "../_stub";
export default function Page() {
  return <StubPage secao="publicidade" />;
}
```

Criar os demais 9 idênticos, trocando apenas o valor de `secao` e o caminho:

- `app/painel/classificados/page.tsx` → `secao="classificados"`
- `app/painel/destaques/page.tsx` → `secao="destaques"`
- `app/painel/guia/page.tsx` → `secao="guia"`
- `app/painel/vagas/page.tsx` → `secao="vagas"`
- `app/painel/eventos/page.tsx` → `secao="eventos"`
- `app/painel/colunistas/page.tsx` → `secao="colunistas"`
- `app/painel/home/page.tsx` → `secao="home"`
- `app/painel/configuracoes/page.tsx` → `secao="configuracoes"`
- `app/painel/usuarios/page.tsx` → `secao="usuarios"`

Modelo completo (substituir `<SECAO>` pelo literal e salvar no caminho correspondente):

```tsx
import StubPage from "../_stub";
export default function Page() {
  return <StubPage secao="<SECAO>" />;
}
```

- [ ] **Step 3: Verificar type-check**

Run: `npm run type-check`
Expected: PASS. O argumento `secao` de cada página deve casar com o tipo `Secao` (TS reclama se algum literal estiver errado).

- [ ] **Step 4: Commit**

```bash
git add app/painel/_stub.tsx app/painel/publicidade app/painel/classificados app/painel/destaques app/painel/guia app/painel/vagas app/painel/eventos app/painel/colunistas app/painel/home app/painel/configuracoes app/painel/usuarios
git commit -m "feat(painel): stubs de todas as secoes com guard de permissao por papel"
```

---

### Task 10: Guard de middleware para `/painel`

**Files:**
- Modify: `proxy.ts:32-36` (inserir bloco `/painel` após o bloco `/admin`)

- [ ] **Step 1: Adicionar o bloco `/painel` no `proxy.ts`**

Em `proxy.ts`, logo após o bloco `if (pathname.startsWith("/admin")) { ... }` (linha 36), inserir:

```typescript
  if (pathname.startsWith("/painel")) {
    if (!user) return NextResponse.redirect(new URL("/login?next=" + pathname, request.url));
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    const rolesPainel = ["admin", "editor", "comercial", "colunista"];
    if (!rolesPainel.includes(profile?.role ?? "")) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }
```

- [ ] **Step 2: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add proxy.ts
git commit -m "feat(painel): middleware barra /painel para quem nao tem papel de painel"
```

---

### Task 11: Verificação end-to-end + build

**Files:** nenhum (verificação).

> Pré-requisito de dados: ter (ou criar) usuários de teste com `role` em cada valor. Atualizar via SQL no Supabase, ex.: `UPDATE profiles SET role='comercial' WHERE email='...';`. Use o MCP do Supabase ou o SQL Editor.

- [ ] **Step 1: Type-check final**

Run: `npm run type-check`
Expected: PASS, zero erros.

- [ ] **Step 2: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros; as rotas `/painel` e `/painel/<secao>` aparecem na lista de rotas.

- [ ] **Step 3: Subir o dev e verificar os critérios de aceite manualmente**

Run: `npm run dev` (porta 3005).

Verificar no navegador (cada item é um critério de aceite da spec):
- Deslogado em `http://localhost:3005/painel` → redireciona para `/login?next=/painel`.
- Logado como `user` em `/painel` → redireciona para `/`.
- Logado como **admin** → sidebar mostra **11** seções.
- Logado como **comercial** → sidebar mostra **4** (Dashboard, Publicidade, Classificados, Destaques).
- Logado como **editor** → sidebar mostra **7** (Dashboard, Guia, Vagas, Eventos, Colunistas, Destaques, Home).
- Logado como **colunista** → sidebar mostra **2** (Dashboard, Colunistas).
- Como **comercial**, digitar `/painel/usuarios` na URL → redireciona ao dashboard `/painel`.
- Abrir cada seção visível → mostra o stub "Em construção — Fase X".
- Header mostra nome + papel; "Sair" encerra a sessão e volta à home; "Ver site" leva a `/`.

- [ ] **Step 4: Atualizar a spec — marcar critérios de aceite**

Em `docs/superpowers/specs/2026-06-05-cms-fase0-fundacao-design.md`, marcar os checkboxes da seção "Critérios de Aceite (Fase 0)" como `[x]` conforme verificados.

- [ ] **Step 5: Commit final**

```bash
git add docs/superpowers/specs/2026-06-05-cms-fase0-fundacao-design.md
git commit -m "docs(painel): marca criterios de aceite da Fase 0 verificados"
```

---

## Notas de escopo (Fora da Fase 0)

- Nenhum CRUD real (Fases 1–3).
- Dashboard com cards/gráficos reais (Fase 3).
- Home builder drag-and-drop (Fase 3).
- Configurações e gestão de usuários funcionais (Fase 3).
- Tabelas `companies`, `jobs`, `articles`, `featured_companies` (criadas nas fases que as usam).
- **Login inalterado** (decisão da spec): a tela `/login` já suporta `?next=`. O acesso ao painel se dá por URL direta `/painel` ou pelo link de login com `?next=/painel`; não há redirect automático pós-login para `/painel` nesta fase (manter o LoginForm intocado). Se desejado no futuro, é um ajuste de uma linha no `LoginForm`.
