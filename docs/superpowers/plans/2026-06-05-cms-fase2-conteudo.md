# CMS Fase 2 (Conteúdo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar o CRUD das 4 seções de conteúdo do painel (Eventos, Colunistas+Artigos, Guia Industrial, Vagas) e expor esse conteúdo no site público.

**Architecture:** Reusa o kit de componentes e o guard `exigirSecao` da Fase 1. Cada seção: `page.tsx` server (guard + fetch) → client component (`DataTable` + `Modal`); mutações em `actions.ts` via service client. Artigos têm tabela própria com RLS de posse por `columnist_id`/`profile_id`; a tela de colunistas é condicional por papel (colunista só vê os próprios artigos). 3 tabelas novas e 5 rotas públicas novas.

**Tech Stack:** Next.js 16 (App Router, Server Actions, async `params`), Supabase SSR + Storage, TypeScript strict, Tailwind 3.4, lucide-react, react-hot-toast, `slugifyTitulo` (`lib/noticias/utils.ts`), `sanitizeContent` (`lib/sanitize.ts`).

> **Verificação:** sem framework de testes (decisão registrada). Portões: `npm run type-check`, `npm run build` e checagem manual. Migrations e e2e via MCP Supabase (projeto `nsixodvejuhnsofpavvc`) na Task 8.

> **Referência:** spec `docs/superpowers/specs/2026-06-05-cms-fase2-conteudo-design.md`. Padrões: Fase 1 (`app/painel/publicidade/*`), página dinâmica (`app/(public)/eventos/[slug]/page.tsx` — `params: Promise<{slug}>` + `await params`), upload (`components/painel/ImageUpload.tsx` → bucket `painel`).

---

## Estrutura de Arquivos

**Criar:**
- `supabase/migrations/012_articles.sql`, `013_companies.sql`, `014_jobs.sql`.
- `app/painel/eventos/actions.ts`, `EventosClient.tsx`.
- `app/painel/guia/actions.ts`, `GuiaClient.tsx`.
- `app/painel/vagas/actions.ts`, `VagasClient.tsx`.
- `app/painel/colunistas/actions.ts`, `ColunistasClient.tsx`.
- `app/(public)/artigos/[slug]/page.tsx`.
- `app/(public)/colunistas/[slug]/page.tsx`.
- `app/(public)/guia/page.tsx`, `GuiaPublicoClient.tsx`.
- `app/(public)/vagas/page.tsx`, `app/(public)/vagas/[id]/page.tsx`.

**Modificar:**
- `types/database.ts` — adicionar `articles`, `companies`, `jobs`.
- `app/painel/eventos/page.tsx`, `guia/page.tsx`, `vagas/page.tsx`, `colunistas/page.tsx` — trocar stub por CRUD.
- `app/(public)/colunistas/page.tsx` — linkar cards para `/colunistas/[slug]`.

---

### Task 1: Migrations + tipos

**Files:**
- Create: `supabase/migrations/012_articles.sql`, `supabase/migrations/013_companies.sql`, `supabase/migrations/014_jobs.sql`
- Modify: `types/database.ts` (adicionar 3 tabelas após `featured_companies`)

- [ ] **Step 1: Criar `012_articles.sql`**

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

CREATE POLICY "articles leitura publica"
  ON public.articles FOR SELECT
  USING (published_at IS NOT NULL);

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

- [ ] **Step 2: Criar `013_companies.sql`**

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

- [ ] **Step 3: Criar `014_jobs.sql`**

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

- [ ] **Step 4: Adicionar tipos em `types/database.ts`**

Inserir dentro de `Tables`, logo após o bloco `featured_companies`:

```typescript
      articles: {
        Row: { id: number; title: string; slug: string; content: string | null; excerpt: string | null; cover_url: string | null; columnist_id: number; published_at: string | null; created_at: string };
        Insert: { title: string; slug: string; content?: string | null; excerpt?: string | null; cover_url?: string | null; columnist_id: number; published_at?: string | null };
        Update: { title?: string; slug?: string; content?: string | null; excerpt?: string | null; cover_url?: string | null; columnist_id?: number; published_at?: string | null };
      };
      companies: {
        Row: { id: number; name: string; category: string | null; city: string | null; state: string | null; phone: string | null; site: string | null; logo_url: string | null; description: string | null; ativo: boolean; created_at: string };
        Insert: { name: string; category?: string | null; city?: string | null; state?: string | null; phone?: string | null; site?: string | null; logo_url?: string | null; description?: string | null; ativo?: boolean };
        Update: { name?: string; category?: string | null; city?: string | null; state?: string | null; phone?: string | null; site?: string | null; logo_url?: string | null; description?: string | null; ativo?: boolean };
      };
      jobs: {
        Row: { id: number; title: string; company: string | null; city: string | null; state: string | null; type: string | null; salary: string | null; description: string | null; link: string | null; contact_email: string | null; ativo: boolean; expires_at: string | null; created_at: string };
        Insert: { title: string; company?: string | null; city?: string | null; state?: string | null; type?: string | null; salary?: string | null; description?: string | null; link?: string | null; contact_email?: string | null; ativo?: boolean; expires_at?: string | null };
        Update: { title?: string; company?: string | null; city?: string | null; state?: string | null; type?: string | null; salary?: string | null; description?: string | null; link?: string | null; contact_email?: string | null; ativo?: boolean; expires_at?: string | null };
      };
```

- [ ] **Step 5: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/012_articles.sql supabase/migrations/013_companies.sql supabase/migrations/014_jobs.sql types/database.ts
git commit -m "feat(painel): migrations articles, companies, jobs + tipos"
```

> Migrations aplicadas na Task 8.

---

### Task 2: Eventos (painel)

**Files:**
- Create: `app/painel/eventos/actions.ts`, `app/painel/eventos/EventosClient.tsx`
- Modify: `app/painel/eventos/page.tsx`

- [ ] **Step 1: Criar `app/painel/eventos/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";
import { slugifyTitulo } from "@/lib/noticias/utils";

export type EventoTipo = "feira" | "congresso" | "seminario" | "workshop" | "treinamento";

export interface EventoInput {
  title: string;
  slug: string;
  description: string | null;
  type: EventoTipo;
  date_start: string;
  date_end: string | null;
  city: string | null;
  state: string | null;
  organizer: string | null;
  image_url: string | null;
}

export async function criarEvento(input: EventoInput) {
  await exigirSecao("eventos");
  const supabase = await createServiceClient();
  const slug = input.slug || slugifyTitulo(input.title);
  const { error } = await (supabase.from("events") as any).insert({ ...input, slug, is_auto: false });
  if (error) throw new Error(error.message);
  revalidatePath("/painel/eventos");
  revalidatePath("/eventos");
}

export async function atualizarEvento(id: number, input: EventoInput) {
  await exigirSecao("eventos");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("events") as any).update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/eventos");
  revalidatePath("/eventos");
}

export async function excluirEvento(id: number) {
  await exigirSecao("eventos");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/eventos");
  revalidatePath("/eventos");
}
```

- [ ] **Step 2: Criar `app/painel/eventos/EventosClient.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DataTable from "@/components/painel/DataTable";
import Modal from "@/components/painel/Modal";
import { FormField, Input, Textarea, Select } from "@/components/painel/FormField";
import ImageUpload from "@/components/painel/ImageUpload";
import Badge from "@/components/painel/Badge";
import { criarEvento, atualizarEvento, excluirEvento, type EventoInput, type EventoTipo } from "./actions";
import type { Database } from "@/types/database";

type Evento = Database["public"]["Tables"]["events"]["Row"];

const TIPOS: EventoTipo[] = ["feira", "congresso", "seminario", "workshop", "treinamento"];

function vazio(): EventoInput {
  return { title: "", slug: "", description: null, type: "feira", date_start: "", date_end: null, city: null, state: null, organizer: null, image_url: null };
}

export default function EventosClient({ itens }: { itens: Evento[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<EventoInput>(vazio());
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() { setEditId(null); setForm(vazio()); setAberto(true); }
  function abrirEdicao(e: Evento) {
    setEditId(e.id);
    setForm({ title: e.title, slug: e.slug, description: e.description, type: e.type, date_start: e.date_start, date_end: e.date_end, city: e.city, state: e.state, organizer: e.organizer, image_url: e.image_url });
    setAberto(true);
  }

  async function salvar() {
    if (!form.title) { toast.error("Título obrigatório"); return; }
    if (!form.date_start) { toast.error("Data de início obrigatória"); return; }
    setSalvando(true);
    try {
      if (editId) await atualizarEvento(editId, form);
      else await criarEvento(form);
      toast.success("Evento salvo");
      setAberto(false);
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSalvando(false); }
  }

  async function remover(id: number) {
    if (!confirm("Excluir este evento?")) return;
    try { await excluirEvento(id); toast.success("Excluído"); router.refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={abrirNovo} className="bg-[#1A2B4A] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] text-sm">
          + Novo evento
        </button>
      </div>

      <DataTable<Evento>
        dados={itens}
        vazio="Nenhum evento."
        colunas={[
          { chave: "image_url", titulo: "Imagem", render: (e) => e.image_url ? <img src={e.image_url} alt="" className="h-10 rounded object-cover" /> : "—" },
          { chave: "title", titulo: "Título" },
          { chave: "type", titulo: "Tipo" },
          { chave: "date_start", titulo: "Início" },
          { chave: "city", titulo: "Local", render: (e) => e.city ? `${e.city}/${e.state ?? ""}` : "—" },
          { chave: "is_auto", titulo: "Origem", render: (e) => <Badge variant={e.is_auto ? "info" : "neutro"}>{e.is_auto ? "Auto" : "Manual"}</Badge> },
        ]}
        acoes={(e) => (
          <div className="flex gap-3 justify-end">
            <button onClick={() => abrirEdicao(e)} className="text-blue-700 hover:text-blue-900 text-xs font-medium">Editar</button>
            <button onClick={() => remover(e.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Excluir</button>
          </div>
        )}
      />

      <Modal aberto={aberto} titulo={editId ? "Editar evento" : "Novo evento"} onFechar={() => setAberto(false)}>
        <ImageUpload label="Imagem" valor={form.image_url} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />
        <FormField label="Título">
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </FormField>
        <FormField label="Slug (deixe vazio para gerar do título)">
          <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
        </FormField>
        <FormField label="Descrição">
          <Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Tipo">
            <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as EventoTipo }))}>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </FormField>
          <FormField label="Organizador">
            <Input value={form.organizer ?? ""} onChange={(e) => setForm((f) => ({ ...f, organizer: e.target.value || null }))} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Início">
            <Input type="date" value={form.date_start} onChange={(e) => setForm((f) => ({ ...f, date_start: e.target.value }))} />
          </FormField>
          <FormField label="Fim">
            <Input type="date" value={form.date_end ?? ""} onChange={(e) => setForm((f) => ({ ...f, date_end: e.target.value || null }))} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Cidade">
            <Input value={form.city ?? ""} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value || null }))} />
          </FormField>
          <FormField label="UF">
            <Input maxLength={2} value={form.state ?? ""} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() || null }))} />
          </FormField>
        </div>
        <button onClick={salvar} disabled={salvando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </Modal>
    </>
  );
}
```

- [ ] **Step 3: Substituir `app/painel/eventos/page.tsx`** (hoje é o stub) por:

```tsx
import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import EventosClient from "./EventosClient";
import type { Database } from "@/types/database";

type Evento = Database["public"]["Tables"]["events"]["Row"];

export default async function EventosPainelPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "eventos")) redirect("/painel");

  const supabase = await createClient();
  const { data: itens } = await supabase
    .from("events").select("*").order("date_start", { ascending: false }) as { data: Evento[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader titulo="Eventos" descricao="Feiras, congressos e eventos do setor." />
      <EventosClient itens={itens ?? []} />
    </div>
  );
}
```

- [ ] **Step 4: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/painel/eventos
git commit -m "feat(painel): CRUD de Eventos"
```

---

### Task 3: Guia Industrial (painel)

**Files:**
- Create: `app/painel/guia/actions.ts`, `app/painel/guia/GuiaClient.tsx`
- Modify: `app/painel/guia/page.tsx`

- [ ] **Step 1: Criar `app/painel/guia/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";

export interface CompanyInput {
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  site: string | null;
  logo_url: string | null;
  description: string | null;
  ativo: boolean;
}

export async function criarEmpresa(input: CompanyInput) {
  await exigirSecao("guia");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("companies") as any).insert(input);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/guia");
  revalidatePath("/guia");
}

export async function atualizarEmpresa(id: number, input: CompanyInput) {
  await exigirSecao("guia");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("companies") as any).update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/guia");
  revalidatePath("/guia");
}

export async function excluirEmpresa(id: number) {
  await exigirSecao("guia");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/guia");
  revalidatePath("/guia");
}
```

- [ ] **Step 2: Criar `app/painel/guia/GuiaClient.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DataTable from "@/components/painel/DataTable";
import Modal from "@/components/painel/Modal";
import { FormField, Input, Textarea } from "@/components/painel/FormField";
import ImageUpload from "@/components/painel/ImageUpload";
import Badge from "@/components/painel/Badge";
import { criarEmpresa, atualizarEmpresa, excluirEmpresa, type CompanyInput } from "./actions";
import type { Database } from "@/types/database";

type Empresa = Database["public"]["Tables"]["companies"]["Row"];

function vazio(): CompanyInput {
  return { name: "", category: null, city: null, state: null, phone: null, site: null, logo_url: null, description: null, ativo: true };
}

export default function GuiaClient({ itens }: { itens: Empresa[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<CompanyInput>(vazio());
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() { setEditId(null); setForm(vazio()); setAberto(true); }
  function abrirEdicao(c: Empresa) {
    setEditId(c.id);
    setForm({ name: c.name, category: c.category, city: c.city, state: c.state, phone: c.phone, site: c.site, logo_url: c.logo_url, description: c.description, ativo: c.ativo });
    setAberto(true);
  }

  async function salvar() {
    if (!form.name) { toast.error("Nome obrigatório"); return; }
    setSalvando(true);
    try {
      if (editId) await atualizarEmpresa(editId, form);
      else await criarEmpresa(form);
      toast.success("Empresa salva");
      setAberto(false);
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSalvando(false); }
  }

  async function remover(id: number) {
    if (!confirm("Excluir esta empresa?")) return;
    try { await excluirEmpresa(id); toast.success("Excluída"); router.refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={abrirNovo} className="bg-[#1A2B4A] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] text-sm">
          + Nova empresa
        </button>
      </div>

      <DataTable<Empresa>
        dados={itens}
        vazio="Nenhuma empresa no guia."
        colunas={[
          { chave: "logo_url", titulo: "Logo", render: (c) => c.logo_url ? <img src={c.logo_url} alt="" className="h-10 rounded object-contain" /> : "—" },
          { chave: "name", titulo: "Nome" },
          { chave: "category", titulo: "Categoria" },
          { chave: "city", titulo: "Cidade", render: (c) => c.city ? `${c.city}/${c.state ?? ""}` : "—" },
          { chave: "ativo", titulo: "Ativo", render: (c) => <Badge variant={c.ativo ? "sucesso" : "neutro"}>{c.ativo ? "Sim" : "Não"}</Badge> },
        ]}
        acoes={(c) => (
          <div className="flex gap-3 justify-end">
            <button onClick={() => abrirEdicao(c)} className="text-blue-700 hover:text-blue-900 text-xs font-medium">Editar</button>
            <button onClick={() => remover(c.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Excluir</button>
          </div>
        )}
      />

      <Modal aberto={aberto} titulo={editId ? "Editar empresa" : "Nova empresa"} onFechar={() => setAberto(false)}>
        <ImageUpload label="Logo" valor={form.logo_url} onChange={(url) => setForm((f) => ({ ...f, logo_url: url }))} />
        <FormField label="Nome">
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Categoria">
            <Input value={form.category ?? ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value || null }))} placeholder="Ex: Fornecedor, Integrador..." />
          </FormField>
          <FormField label="Telefone">
            <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value || null }))} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Cidade">
            <Input value={form.city ?? ""} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value || null }))} />
          </FormField>
          <FormField label="UF">
            <Input maxLength={2} value={form.state ?? ""} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() || null }))} />
          </FormField>
        </div>
        <FormField label="Site">
          <Input value={form.site ?? ""} onChange={(e) => setForm((f) => ({ ...f, site: e.target.value || null }))} placeholder="https://..." />
        </FormField>
        <FormField label="Descrição">
          <Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))} />
        </FormField>
        <label className="flex items-center gap-2 mb-4 text-sm">
          <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} />
          Exibir no guia
        </label>
        <button onClick={salvar} disabled={salvando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </Modal>
    </>
  );
}
```

- [ ] **Step 3: Substituir `app/painel/guia/page.tsx`** por:

```tsx
import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import GuiaClient from "./GuiaClient";
import type { Database } from "@/types/database";

type Empresa = Database["public"]["Tables"]["companies"]["Row"];

export default async function GuiaPainelPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "guia")) redirect("/painel");

  const supabase = await createClient();
  const { data: itens } = await supabase
    .from("companies").select("*").order("name", { ascending: true }) as { data: Empresa[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader titulo="Guia Industrial" descricao="Guia industrial de empresas e fornecedores." />
      <GuiaClient itens={itens ?? []} />
    </div>
  );
}
```

- [ ] **Step 4: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/painel/guia
git commit -m "feat(painel): CRUD do Guia Industrial"
```

---

### Task 4: Vagas (painel)

**Files:**
- Create: `app/painel/vagas/actions.ts`, `app/painel/vagas/VagasClient.tsx`
- Modify: `app/painel/vagas/page.tsx`

- [ ] **Step 1: Criar `app/painel/vagas/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";

export interface JobInput {
  title: string;
  company: string | null;
  city: string | null;
  state: string | null;
  type: string | null;
  salary: string | null;
  description: string | null;
  link: string | null;
  contact_email: string | null;
  ativo: boolean;
  expires_at: string | null;
}

export async function criarVaga(input: JobInput) {
  await exigirSecao("vagas");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("jobs") as any).insert(input);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/vagas");
  revalidatePath("/vagas");
}

export async function atualizarVaga(id: number, input: JobInput) {
  await exigirSecao("vagas");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("jobs") as any).update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/vagas");
  revalidatePath("/vagas");
}

export async function excluirVaga(id: number) {
  await exigirSecao("vagas");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/vagas");
  revalidatePath("/vagas");
}
```

- [ ] **Step 2: Criar `app/painel/vagas/VagasClient.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DataTable from "@/components/painel/DataTable";
import Modal from "@/components/painel/Modal";
import { FormField, Input, Textarea } from "@/components/painel/FormField";
import Badge from "@/components/painel/Badge";
import { criarVaga, atualizarVaga, excluirVaga, type JobInput } from "./actions";
import type { Database } from "@/types/database";

type Vaga = Database["public"]["Tables"]["jobs"]["Row"];

function vazio(): JobInput {
  return { title: "", company: null, city: null, state: null, type: null, salary: null, description: null, link: null, contact_email: null, ativo: true, expires_at: null };
}

export default function VagasClient({ itens }: { itens: Vaga[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<JobInput>(vazio());
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() { setEditId(null); setForm(vazio()); setAberto(true); }
  function abrirEdicao(v: Vaga) {
    setEditId(v.id);
    setForm({ title: v.title, company: v.company, city: v.city, state: v.state, type: v.type, salary: v.salary, description: v.description, link: v.link, contact_email: v.contact_email, ativo: v.ativo, expires_at: v.expires_at });
    setAberto(true);
  }

  async function salvar() {
    if (!form.title) { toast.error("Título obrigatório"); return; }
    setSalvando(true);
    try {
      if (editId) await atualizarVaga(editId, form);
      else await criarVaga(form);
      toast.success("Vaga salva");
      setAberto(false);
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSalvando(false); }
  }

  async function remover(id: number) {
    if (!confirm("Excluir esta vaga?")) return;
    try { await excluirVaga(id); toast.success("Excluída"); router.refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={abrirNovo} className="bg-[#1A2B4A] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] text-sm">
          + Nova vaga
        </button>
      </div>

      <DataTable<Vaga>
        dados={itens}
        vazio="Nenhuma vaga."
        colunas={[
          { chave: "title", titulo: "Título" },
          { chave: "company", titulo: "Empresa" },
          { chave: "city", titulo: "Local", render: (v) => v.city ? `${v.city}/${v.state ?? ""}` : "—" },
          { chave: "type", titulo: "Tipo" },
          { chave: "expires_at", titulo: "Expira" },
          { chave: "ativo", titulo: "Ativa", render: (v) => <Badge variant={v.ativo ? "sucesso" : "neutro"}>{v.ativo ? "Sim" : "Não"}</Badge> },
        ]}
        acoes={(v) => (
          <div className="flex gap-3 justify-end">
            <button onClick={() => abrirEdicao(v)} className="text-blue-700 hover:text-blue-900 text-xs font-medium">Editar</button>
            <button onClick={() => remover(v.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Excluir</button>
          </div>
        )}
      />

      <Modal aberto={aberto} titulo={editId ? "Editar vaga" : "Nova vaga"} onFechar={() => setAberto(false)}>
        <FormField label="Título">
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Empresa">
            <Input value={form.company ?? ""} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value || null }))} />
          </FormField>
          <FormField label="Tipo">
            <Input value={form.type ?? ""} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value || null }))} placeholder="CLT, PJ, Estágio..." />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Cidade">
            <Input value={form.city ?? ""} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value || null }))} />
          </FormField>
          <FormField label="UF">
            <Input maxLength={2} value={form.state ?? ""} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() || null }))} />
          </FormField>
        </div>
        <FormField label="Salário">
          <Input value={form.salary ?? ""} onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value || null }))} placeholder="A combinar / R$ ..." />
        </FormField>
        <FormField label="Descrição">
          <Textarea rows={4} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Link de candidatura">
            <Input value={form.link ?? ""} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value || null }))} placeholder="https://..." />
          </FormField>
          <FormField label="E-mail de contato">
            <Input value={form.contact_email ?? ""} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value || null }))} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Expira em">
            <Input type="date" value={form.expires_at ?? ""} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value || null }))} />
          </FormField>
          <FormField label="Ativa">
            <label className="flex items-center gap-2 mt-2 text-sm">
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} />
              Exibir no site
            </label>
          </FormField>
        </div>
        <button onClick={salvar} disabled={salvando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </Modal>
    </>
  );
}
```

- [ ] **Step 3: Substituir `app/painel/vagas/page.tsx`** por:

```tsx
import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import VagasClient from "./VagasClient";
import type { Database } from "@/types/database";

type Vaga = Database["public"]["Tables"]["jobs"]["Row"];

export default async function VagasPainelPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "vagas")) redirect("/painel");

  const supabase = await createClient();
  const { data: itens } = await supabase
    .from("jobs").select("*").order("created_at", { ascending: false }) as { data: Vaga[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader titulo="Vagas" descricao="Vagas de emprego do setor metalmecânico." />
      <VagasClient itens={itens ?? []} />
    </div>
  );
}
```

- [ ] **Step 4: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/painel/vagas
git commit -m "feat(painel): CRUD de Vagas"
```

---

### Task 5: Colunistas + Artigos (painel, condicional por papel)

**Files:**
- Create: `app/painel/colunistas/actions.ts`, `app/painel/colunistas/ColunistasClient.tsx`
- Modify: `app/painel/colunistas/page.tsx`

- [ ] **Step 1: Criar `app/painel/colunistas/actions.ts`**

`columnistIdDoUsuario` resolve o `columnists.id` do colunista logado. As actions de artigo checam posse quando o papel é `colunista`.

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";
import { slugifyTitulo } from "@/lib/noticias/utils";

export interface ColunistaInput {
  nome: string;
  slug: string;
  cargo: string | null;
  especialidade: string | null;
  bio: string | null;
  foto_url: string | null;
  ativo: boolean;
  profile_id: string | null;
}

export interface ArtigoInput {
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  cover_url: string | null;
  columnist_id: number;
  publicar: boolean;
}

/** Retorna o columnists.id vinculado ao usuário (profile_id), ou null. */
export async function columnistIdDoUsuario(userId: string): Promise<number | null> {
  const supabase = await createServiceClient();
  const { data } = await (supabase.from("columnists") as any)
    .select("id").eq("profile_id", userId).maybeSingle();
  return data?.id ?? null;
}

// ---- Colunistas (somente admin/editor) ----

export async function criarColunista(input: ColunistaInput) {
  const { role } = await exigirSecao("colunistas");
  if (role !== "admin" && role !== "editor") throw new Error("Não autorizado");
  const supabase = await createServiceClient();
  const slug = input.slug || slugifyTitulo(input.nome);
  const { error } = await (supabase.from("columnists") as any).insert({ ...input, slug });
  if (error) throw new Error(error.message);
  revalidatePath("/painel/colunistas");
  revalidatePath("/colunistas");
}

export async function atualizarColunista(id: number, input: ColunistaInput) {
  const { role } = await exigirSecao("colunistas");
  if (role !== "admin" && role !== "editor") throw new Error("Não autorizado");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("columnists") as any).update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/colunistas");
  revalidatePath("/colunistas");
}

export async function excluirColunista(id: number) {
  const { role } = await exigirSecao("colunistas");
  if (role !== "admin" && role !== "editor") throw new Error("Não autorizado");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("columnists").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/colunistas");
  revalidatePath("/colunistas");
}

// ---- Artigos (admin/editor: qualquer; colunista: só os próprios) ----

async function validarPosseArtigo(columnistId: number) {
  const { userId, role } = await exigirSecao("colunistas");
  if (role === "admin" || role === "editor") return;
  const meu = await columnistIdDoUsuario(userId);
  if (meu !== columnistId) throw new Error("Não autorizado a este artigo");
}

export async function criarArtigo(input: ArtigoInput) {
  await validarPosseArtigo(input.columnist_id);
  const supabase = await createServiceClient();
  const slug = input.slug || slugifyTitulo(input.title);
  const { error } = await (supabase.from("articles") as any).insert({
    title: input.title, slug, excerpt: input.excerpt, content: input.content,
    cover_url: input.cover_url, columnist_id: input.columnist_id,
    published_at: input.publicar ? new Date().toISOString() : null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/painel/colunistas");
  revalidatePath("/artigos/" + slug);
}

export async function atualizarArtigo(id: number, input: ArtigoInput) {
  await validarPosseArtigo(input.columnist_id);
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("articles") as any).update({
    title: input.title, slug: input.slug, excerpt: input.excerpt, content: input.content,
    cover_url: input.cover_url, columnist_id: input.columnist_id,
    published_at: input.publicar ? new Date().toISOString() : null,
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/colunistas");
  revalidatePath("/artigos/" + input.slug);
}

export async function excluirArtigo(id: number, columnistId: number) {
  await validarPosseArtigo(columnistId);
  const supabase = await createServiceClient();
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/colunistas");
}
```

- [ ] **Step 2: Criar `app/painel/colunistas/ColunistasClient.tsx`**

Recebe `role`, a lista de colunistas, os artigos visíveis e o `meuColunistaId` (quando o papel é colunista). Renderiza o bloco de colunistas só para admin/editor.

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DataTable from "@/components/painel/DataTable";
import Modal from "@/components/painel/Modal";
import { FormField, Input, Textarea, Select } from "@/components/painel/FormField";
import ImageUpload from "@/components/painel/ImageUpload";
import Badge from "@/components/painel/Badge";
import {
  criarColunista, atualizarColunista, excluirColunista,
  criarArtigo, atualizarArtigo, excluirArtigo,
  type ColunistaInput, type ArtigoInput,
} from "./actions";
import type { Database } from "@/types/database";
import type { Role } from "@/lib/painel/permissions";

type Colunista = Database["public"]["Tables"]["columnists"]["Row"];
type Artigo = Database["public"]["Tables"]["articles"]["Row"];

function colunistaVazio(): ColunistaInput {
  return { nome: "", slug: "", cargo: null, especialidade: null, bio: null, foto_url: null, ativo: true, profile_id: null };
}
function artigoVazio(columnistId: number): ArtigoInput {
  return { title: "", slug: "", excerpt: null, content: null, cover_url: null, columnist_id: columnistId, publicar: false };
}

export default function ColunistasClient({
  role, colunistas, artigos, meuColunistaId,
}: {
  role: Role;
  colunistas: Colunista[];
  artigos: Artigo[];
  meuColunistaId: number | null;
}) {
  const router = useRouter();
  const ehGestor = role === "admin" || role === "editor";

  // ----- Colunistas modal -----
  const [colAberto, setColAberto] = useState(false);
  const [colEditId, setColEditId] = useState<number | null>(null);
  const [colForm, setColForm] = useState<ColunistaInput>(colunistaVazio());
  const [colSalvando, setColSalvando] = useState(false);

  function abrirNovoColunista() { setColEditId(null); setColForm(colunistaVazio()); setColAberto(true); }
  function abrirEdicaoColunista(c: Colunista) {
    setColEditId(c.id);
    setColForm({ nome: c.nome, slug: c.slug, cargo: c.cargo, especialidade: c.especialidade, bio: c.bio, foto_url: c.foto_url, ativo: c.ativo, profile_id: c.profile_id });
    setColAberto(true);
  }
  async function salvarColunista() {
    if (!colForm.nome) { toast.error("Nome obrigatório"); return; }
    setColSalvando(true);
    try {
      if (colEditId) await atualizarColunista(colEditId, colForm);
      else await criarColunista(colForm);
      toast.success("Colunista salvo");
      setColAberto(false);
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setColSalvando(false); }
  }
  async function removerColunista(id: number) {
    if (!confirm("Excluir este colunista? Os artigos dele também serão removidos.")) return;
    try { await excluirColunista(id); toast.success("Excluído"); router.refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  // ----- Artigos modal -----
  const colunistaPadrao = ehGestor ? (colunistas[0]?.id ?? 0) : (meuColunistaId ?? 0);
  const [artAberto, setArtAberto] = useState(false);
  const [artEditId, setArtEditId] = useState<number | null>(null);
  const [artForm, setArtForm] = useState<ArtigoInput>(artigoVazio(colunistaPadrao));
  const [artSalvando, setArtSalvando] = useState(false);

  function abrirNovoArtigo() { setArtEditId(null); setArtForm(artigoVazio(colunistaPadrao)); setArtAberto(true); }
  function abrirEdicaoArtigo(a: Artigo) {
    setArtEditId(a.id);
    setArtForm({ title: a.title, slug: a.slug, excerpt: a.excerpt, content: a.content, cover_url: a.cover_url, columnist_id: a.columnist_id, publicar: a.published_at != null });
    setArtAberto(true);
  }
  async function salvarArtigo() {
    if (!artForm.title) { toast.error("Título obrigatório"); return; }
    if (!artForm.columnist_id) { toast.error("Selecione um colunista"); return; }
    setArtSalvando(true);
    try {
      if (artEditId) await atualizarArtigo(artEditId, artForm);
      else await criarArtigo(artForm);
      toast.success("Artigo salvo");
      setArtAberto(false);
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setArtSalvando(false); }
  }
  async function removerArtigo(a: Artigo) {
    if (!confirm("Excluir este artigo?")) return;
    try { await excluirArtigo(a.id, a.columnist_id); toast.success("Excluído"); router.refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  const nomeColunista = (id: number) => colunistas.find((c) => c.id === id)?.nome ?? "—";

  return (
    <div className="space-y-10">
      {!ehGestor && meuColunistaId === null && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
          Seu usuário ainda não está vinculado a um colunista — peça ao administrador para fazer o vínculo.
        </div>
      )}

      {ehGestor && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-[#1A2B4A]">Colunistas</h2>
            <button onClick={abrirNovoColunista} className="bg-[#1A2B4A] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] text-sm">
              + Novo colunista
            </button>
          </div>
          <DataTable<Colunista>
            dados={colunistas}
            vazio="Nenhum colunista."
            colunas={[
              { chave: "foto_url", titulo: "Foto", render: (c) => c.foto_url ? <img src={c.foto_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : "—" },
              { chave: "nome", titulo: "Nome" },
              { chave: "especialidade", titulo: "Especialidade" },
              { chave: "profile_id", titulo: "Vínculo", render: (c) => <Badge variant={c.profile_id ? "sucesso" : "neutro"}>{c.profile_id ? "Vinculado" : "Sem login"}</Badge> },
              { chave: "ativo", titulo: "Ativo", render: (c) => <Badge variant={c.ativo ? "sucesso" : "neutro"}>{c.ativo ? "Sim" : "Não"}</Badge> },
            ]}
            acoes={(c) => (
              <div className="flex gap-3 justify-end">
                <button onClick={() => abrirEdicaoColunista(c)} className="text-blue-700 hover:text-blue-900 text-xs font-medium">Editar</button>
                <button onClick={() => removerColunista(c.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Excluir</button>
              </div>
            )}
          />
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-[#1A2B4A]">{ehGestor ? "Artigos" : "Meus Artigos"}</h2>
          {(ehGestor ? colunistas.length > 0 : meuColunistaId !== null) && (
            <button onClick={abrirNovoArtigo} className="bg-[#1A2B4A] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] text-sm">
              + Novo artigo
            </button>
          )}
        </div>
        <DataTable<Artigo>
          dados={artigos}
          vazio="Nenhum artigo."
          colunas={[
            { chave: "title", titulo: "Título" },
            { chave: "columnist_id", titulo: "Colunista", render: (a) => nomeColunista(a.columnist_id) },
            { chave: "published_at", titulo: "Status", render: (a) => <Badge variant={a.published_at ? "sucesso" : "alerta"}>{a.published_at ? "Publicado" : "Rascunho"}</Badge> },
          ]}
          acoes={(a) => (
            <div className="flex gap-3 justify-end">
              <button onClick={() => abrirEdicaoArtigo(a)} className="text-blue-700 hover:text-blue-900 text-xs font-medium">Editar</button>
              <button onClick={() => removerArtigo(a)} className="text-red-600 hover:text-red-800 text-xs font-medium">Excluir</button>
            </div>
          )}
        />
      </section>

      {/* Modal colunista */}
      <Modal aberto={colAberto} titulo={colEditId ? "Editar colunista" : "Novo colunista"} onFechar={() => setColAberto(false)}>
        <ImageUpload label="Foto" valor={colForm.foto_url} onChange={(url) => setColForm((f) => ({ ...f, foto_url: url }))} />
        <FormField label="Nome">
          <Input value={colForm.nome} onChange={(e) => setColForm((f) => ({ ...f, nome: e.target.value }))} />
        </FormField>
        <FormField label="Slug (vazio = gerar do nome)">
          <Input value={colForm.slug} onChange={(e) => setColForm((f) => ({ ...f, slug: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Cargo">
            <Input value={colForm.cargo ?? ""} onChange={(e) => setColForm((f) => ({ ...f, cargo: e.target.value || null }))} />
          </FormField>
          <FormField label="Especialidade">
            <Input value={colForm.especialidade ?? ""} onChange={(e) => setColForm((f) => ({ ...f, especialidade: e.target.value || null }))} />
          </FormField>
        </div>
        <FormField label="Bio">
          <Textarea rows={3} value={colForm.bio ?? ""} onChange={(e) => setColForm((f) => ({ ...f, bio: e.target.value || null }))} />
        </FormField>
        <FormField label="ID do usuário de login (profile_id, opcional)">
          <Input value={colForm.profile_id ?? ""} onChange={(e) => setColForm((f) => ({ ...f, profile_id: e.target.value || null }))} placeholder="UUID do usuário em profiles" />
        </FormField>
        <label className="flex items-center gap-2 mb-4 text-sm">
          <input type="checkbox" checked={colForm.ativo} onChange={(e) => setColForm((f) => ({ ...f, ativo: e.target.checked }))} />
          Ativo
        </label>
        <button onClick={salvarColunista} disabled={colSalvando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
          {colSalvando ? "Salvando..." : "Salvar"}
        </button>
      </Modal>

      {/* Modal artigo */}
      <Modal aberto={artAberto} titulo={artEditId ? "Editar artigo" : "Novo artigo"} onFechar={() => setArtAberto(false)}>
        <ImageUpload label="Capa" valor={artForm.cover_url} onChange={(url) => setArtForm((f) => ({ ...f, cover_url: url }))} />
        <FormField label="Título">
          <Input value={artForm.title} onChange={(e) => setArtForm((f) => ({ ...f, title: e.target.value }))} />
        </FormField>
        <FormField label="Slug (vazio = gerar do título)">
          <Input value={artForm.slug} onChange={(e) => setArtForm((f) => ({ ...f, slug: e.target.value }))} />
        </FormField>
        {ehGestor && (
          <FormField label="Colunista">
            <Select value={artForm.columnist_id} onChange={(e) => setArtForm((f) => ({ ...f, columnist_id: Number(e.target.value) }))}>
              {colunistas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </FormField>
        )}
        <FormField label="Resumo">
          <Textarea rows={2} value={artForm.excerpt ?? ""} onChange={(e) => setArtForm((f) => ({ ...f, excerpt: e.target.value || null }))} />
        </FormField>
        <FormField label="Conteúdo (HTML)">
          <Textarea rows={8} value={artForm.content ?? ""} onChange={(e) => setArtForm((f) => ({ ...f, content: e.target.value || null }))} />
        </FormField>
        <label className="flex items-center gap-2 mb-4 text-sm">
          <input type="checkbox" checked={artForm.publicar} onChange={(e) => setArtForm((f) => ({ ...f, publicar: e.target.checked }))} />
          Publicar (desmarcado = rascunho)
        </label>
        <button onClick={salvarArtigo} disabled={artSalvando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
          {artSalvando ? "Salvando..." : "Salvar"}
        </button>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 3: Substituir `app/painel/colunistas/page.tsx`** por:

```tsx
import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import ColunistasClient from "./ColunistasClient";
import { columnistIdDoUsuario } from "./actions";
import type { Database } from "@/types/database";

type Colunista = Database["public"]["Tables"]["columnists"]["Row"];
type Artigo = Database["public"]["Tables"]["articles"]["Row"];

export default async function ColunistasPainelPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "colunistas")) redirect("/painel");

  const ehGestor = u.role === "admin" || u.role === "editor";
  const supabase = await createClient();

  const { data: colunistas } = await supabase
    .from("columnists").select("*").order("nome", { ascending: true }) as { data: Colunista[] | null; error: unknown };

  const meuColunistaId = ehGestor ? null : await columnistIdDoUsuario(u.userId);

  let query = supabase.from("articles").select("*");
  if (!ehGestor) query = query.eq("columnist_id", meuColunistaId ?? -1);
  const { data: artigos } = await query.order("created_at", { ascending: false }) as { data: Artigo[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader titulo="Colunistas" descricao="Colunistas e seus artigos de opinião." />
      <ColunistasClient
        role={u.role}
        colunistas={colunistas ?? []}
        artigos={artigos ?? []}
        meuColunistaId={meuColunistaId}
      />
    </div>
  );
}
```

- [ ] **Step 4: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/painel/colunistas
git commit -m "feat(painel): gestao de Colunistas + Artigos (colunista ve so os proprios)"
```

---

### Task 6: Render público — Artigos e perfil de Colunista

**Files:**
- Create: `app/(public)/artigos/[slug]/page.tsx`, `app/(public)/colunistas/[slug]/page.tsx`
- Modify: `app/(public)/colunistas/page.tsx` (linkar cards para `/colunistas/[slug]`)

- [ ] **Step 1: Criar `app/(public)/artigos/[slug]/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { sanitizeContent } from "@/lib/sanitize";
import type { Database } from "@/types/database";

type Artigo = Database["public"]["Tables"]["articles"]["Row"];
type Colunista = Database["public"]["Tables"]["columnists"]["Row"];

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 300;

export default async function ArtigoPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: artigo } = await supabase
    .from("articles").select("*").eq("slug", slug).not("published_at", "is", null).maybeSingle() as { data: Artigo | null; error: unknown };

  if (!artigo) notFound();

  const { data: colunista } = await supabase
    .from("columnists").select("*").eq("id", artigo.columnist_id).maybeSingle() as { data: Colunista | null; error: unknown };

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      {colunista && (
        <Link href={"/colunistas/" + colunista.slug} className="inline-flex items-center gap-2 text-sm text-[#C9A84C] font-semibold mb-3">
          {colunista.nome}
        </Link>
      )}
      <h1 className="text-3xl font-bold text-[#1A2B4A] leading-tight">{artigo.title}</h1>
      {artigo.published_at && (
        <p className="text-sm text-gray-400 mt-2">
          {format(new Date(artigo.published_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      )}
      {artigo.cover_url && (
        <img src={artigo.cover_url} alt={artigo.title} className="w-full rounded-xl mt-6 object-cover" />
      )}
      {artigo.content && (
        <article
          className="prose prose-lg max-w-none mt-8"
          dangerouslySetInnerHTML={{ __html: sanitizeContent(artigo.content) }}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Criar `app/(public)/colunistas/[slug]/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Database } from "@/types/database";

type Colunista = Database["public"]["Tables"]["columnists"]["Row"];
type Artigo = Database["public"]["Tables"]["articles"]["Row"];

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 300;

export default async function ColunistaPerfilPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: colunista } = await supabase
    .from("columnists").select("*").eq("slug", slug).maybeSingle() as { data: Colunista | null; error: unknown };

  if (!colunista) notFound();

  const { data: artigos } = await supabase
    .from("articles").select("*").eq("columnist_id", colunista.id).not("published_at", "is", null)
    .order("published_at", { ascending: false }) as { data: Artigo[] | null; error: unknown };

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-4 mb-8">
        {colunista.foto_url
          ? <img src={colunista.foto_url} alt={colunista.nome} className="w-20 h-20 rounded-full object-cover" />
          : <div className="w-20 h-20 rounded-full bg-[#1A2B4A] text-white flex items-center justify-center font-bold text-xl">{colunista.iniciais ?? colunista.nome[0]}</div>}
        <div>
          <h1 className="text-2xl font-bold text-[#1A2B4A]">{colunista.nome}</h1>
          {colunista.especialidade && <p className="text-sm text-[#C9A84C] font-semibold">{colunista.especialidade}</p>}
          {colunista.bio && <p className="text-sm text-gray-500 mt-1">{colunista.bio}</p>}
        </div>
      </div>

      <h2 className="text-lg font-bold text-[#1A2B4A] mb-4">Artigos</h2>
      {(!artigos || artigos.length === 0) ? (
        <p className="text-gray-400">Nenhum artigo publicado ainda.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {artigos.map((a) => (
            <Link key={a.id} href={"/artigos/" + a.slug} className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              {a.cover_url && <img src={a.cover_url} alt={a.title} className="w-full aspect-video object-cover" />}
              <div className="p-4">
                <h3 className="font-semibold text-gray-900 group-hover:text-[#1A2B4A] line-clamp-2">{a.title}</h3>
                {a.excerpt && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{a.excerpt}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 3: Linkar os cards em `app/(public)/colunistas/page.tsx`**

Abrir o arquivo e localizar onde cada colunista é renderizado. Envolver o card de cada colunista com um `Link` para `/colunistas/${slug}` (o arquivo já busca `columnists`, que têm `slug`). Concretamente: onde hoje há o container de um colunista (ex.: `<div className="...card...">...</div>`), trocar por:

```tsx
<Link href={"/colunistas/" + c.slug} className="...mesmas classes do card...">
  ... conteúdo do card ...
</Link>
```

E garantir o import no topo: `import Link from "next/link";` (se ainda não existir). Use o nome de variável real do `.map` do arquivo (ex.: `c` ou `colunista`).

- [ ] **Step 4: Verificar type-check + build**

Run: `npm run type-check && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/artigos" "app/(public)/colunistas"
git commit -m "feat: paginas publicas de artigo e perfil de colunista"
```

---

### Task 7: Render público — Guia e Vagas

**Files:**
- Create: `app/(public)/guia/page.tsx`, `app/(public)/guia/GuiaPublicoClient.tsx`, `app/(public)/vagas/page.tsx`, `app/(public)/vagas/[id]/page.tsx`

- [ ] **Step 1: Criar `app/(public)/guia/GuiaPublicoClient.tsx`** (filtro client por categoria)

```tsx
"use client";

import { useState } from "react";
import type { Database } from "@/types/database";

type Empresa = Database["public"]["Tables"]["companies"]["Row"];

export default function GuiaPublicoClient({ empresas }: { empresas: Empresa[] }) {
  const categorias = Array.from(new Set(empresas.map((e) => e.category).filter(Boolean))) as string[];
  const [cat, setCat] = useState<string>("todas");
  const filtradas = cat === "todas" ? empresas : empresas.filter((e) => e.category === cat);

  return (
    <>
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={() => setCat("todas")} className={`px-3 py-1.5 rounded-lg text-sm ${cat === "todas" ? "bg-[#1A2B4A] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>Todas</button>
        {categorias.map((c) => (
          <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-lg text-sm ${cat === c ? "bg-[#1A2B4A] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{c}</button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <p className="text-gray-400">Nenhuma empresa cadastrada.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtradas.map((e) => (
            <div key={e.id} className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center gap-3 mb-3">
                {e.logo_url
                  ? <img src={e.logo_url} alt={e.name} className="h-12 w-12 object-contain" />
                  : <div className="h-12 w-12 rounded bg-[#1A2B4A]/10 flex items-center justify-center font-bold text-[#1A2B4A]">{e.name[0]}</div>}
                <div>
                  <p className="font-semibold text-[#1A2B4A]">{e.name}</p>
                  {e.category && <p className="text-xs text-[#C9A84C] font-semibold">{e.category}</p>}
                </div>
              </div>
              {e.description && <p className="text-sm text-gray-500 line-clamp-3">{e.description}</p>}
              <div className="text-sm text-gray-500 mt-3 space-y-1">
                {(e.city || e.state) && <p>{e.city}{e.state ? "/" + e.state : ""}</p>}
                {e.phone && <p>{e.phone}</p>}
                {e.site && <a href={e.site} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">Visitar site</a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Criar `app/(public)/guia/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import GuiaPublicoClient from "./GuiaPublicoClient";
import type { Database } from "@/types/database";

type Empresa = Database["public"]["Tables"]["companies"]["Row"];

export const revalidate = 300;

export default async function GuiaPublicoPage() {
  const supabase = await createClient();
  const { data: empresas } = await supabase
    .from("companies").select("*").eq("ativo", true).order("name", { ascending: true }) as { data: Empresa[] | null; error: unknown };

  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-[#1A2B4A] mb-1">Guia Industrial</h1>
      <p className="text-sm text-gray-500 mb-6">Empresas e fornecedores do setor metalmecânico.</p>
      <GuiaPublicoClient empresas={empresas ?? []} />
    </main>
  );
}
```

- [ ] **Step 3: Criar `app/(public)/vagas/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Database } from "@/types/database";

type Vaga = Database["public"]["Tables"]["jobs"]["Row"];

export const revalidate = 300;

export default async function VagasPage() {
  const supabase = await createClient();
  const hoje = new Date().toISOString().split("T")[0];
  const { data: vagas } = await supabase
    .from("jobs").select("*").eq("ativo", true)
    .or(`expires_at.is.null,expires_at.gte.${hoje}`)
    .order("created_at", { ascending: false }) as { data: Vaga[] | null; error: unknown };

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-[#1A2B4A] mb-1">Vagas</h1>
      <p className="text-sm text-gray-500 mb-6">Oportunidades no setor metalmecânico.</p>

      {(!vagas || vagas.length === 0) ? (
        <p className="text-gray-400">Nenhuma vaga aberta no momento.</p>
      ) : (
        <div className="space-y-3">
          {vagas.map((v) => (
            <Link key={v.id} href={"/vagas/" + v.id} className="group block bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <h2 className="font-semibold text-[#1A2B4A] group-hover:text-[#C9A84C]">{v.title}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {[v.company, v.city && `${v.city}/${v.state ?? ""}`, v.type].filter(Boolean).join(" · ")}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Criar `app/(public)/vagas/[id]/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Database } from "@/types/database";

type Vaga = Database["public"]["Tables"]["jobs"]["Row"];

type Props = { params: Promise<{ id: string }> };

export const revalidate = 300;

export default async function VagaDetalhePage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: vaga } = await supabase
    .from("jobs").select("*").eq("id", Number(id)).eq("ativo", true).maybeSingle() as { data: Vaga | null; error: unknown };

  if (!vaga) notFound();

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-[#1A2B4A]">{vaga.title}</h1>
      <p className="text-sm text-gray-500 mt-1">
        {[vaga.company, vaga.city && `${vaga.city}/${vaga.state ?? ""}`, vaga.type].filter(Boolean).join(" · ")}
      </p>
      {vaga.salary && <p className="text-sm font-semibold text-[#1A2B4A] mt-2">Salário: {vaga.salary}</p>}

      {vaga.description && (
        <div className="mt-6 text-gray-700 whitespace-pre-wrap">{vaga.description}</div>
      )}

      <div className="mt-8 bg-gray-50 rounded-xl p-5">
        <h2 className="font-semibold text-[#1A2B4A] mb-2">Como se candidatar</h2>
        {vaga.link && <a href={vaga.link} target="_blank" rel="noopener noreferrer" className="block text-blue-700 hover:underline">Candidatar-se pelo link</a>}
        {vaga.contact_email && <a href={"mailto:" + vaga.contact_email} className="block text-blue-700 hover:underline">{vaga.contact_email}</a>}
        {!vaga.link && !vaga.contact_email && <p className="text-sm text-gray-400">Sem informações de contato.</p>}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Verificar type-check + build**

Run: `npm run type-check && npm run build`
Expected: PASS; rotas `/guia`, `/vagas`, `/vagas/[id]`, `/artigos/[slug]`, `/colunistas/[slug]` aparecem.

- [ ] **Step 6: Commit**

```bash
git add "app/(public)/guia" "app/(public)/vagas"
git commit -m "feat: paginas publicas do Guia Industrial e Vagas"
```

---

### Task 8: Aplicar migrations + verificação end-to-end

**Files:** nenhum (DB + verificação).

- [ ] **Step 1: Aplicar as migrations no Supabase**

Aplicar `012_articles.sql`, `013_companies.sql`, `014_jobs.sql` via MCP (`apply_migration`, projeto `nsixodvejuhnsofpavvc`) ou SQL Editor.

Verificar:
```sql
SELECT to_regclass('public.articles')::text, to_regclass('public.companies')::text, to_regclass('public.jobs')::text;
```
Expected: as 3 tabelas existem.

- [ ] **Step 2: Type-check + build finais**

Run: `npm run type-check && npm run build`
Expected: PASS.

- [ ] **Step 3: Verificação manual (logado como admin)**

- **Eventos:** criar evento manual → aparece em `/eventos` e no painel marcado "Manual"; eventos `is_auto` aparecem como "Auto"; editar/excluir.
- **Guia:** cadastrar empresa com logo + categoria → aparece em `/guia`; o filtro por categoria funciona; desativar → some.
- **Vagas:** cadastrar vaga com `link` e `contact_email` → aparece em `/vagas`; `/vagas/[id]` mostra descrição e contatos; marcar inativa/expirada → some.
- **Colunistas/Artigos:** criar colunista (vincular ao seu `profile_id` via UUID), criar artigo publicado → aparece em `/artigos/[slug]` e em `/colunistas/[slug]`; rascunho não aparece no site.
- **Upload:** imagem de evento, foto de colunista, capa de artigo e logo de empresa gravam no bucket `painel`.

- [ ] **Step 4: Verificação do colunista self-service (flip de papel, opcional)**

Para confirmar o isolamento por colunista: vincular um colunista ao usuário admin (setar `columnists.profile_id` = id do usuário), trocar temporariamente o papel do usuário para `colunista` (`UPDATE profiles SET role='colunista' ...`), recarregar `/painel/colunistas` e confirmar que vê só os próprios artigos e não vê o bloco "Colunistas". Restaurar o papel para `admin` ao final.

- [ ] **Step 5: Marcar critérios de aceite na spec**

Em `docs/superpowers/specs/2026-06-05-cms-fase2-conteudo-design.md`, marcar os checkboxes verificados como `[x]`.

- [ ] **Step 6: Commit final**

```bash
git add docs/superpowers/specs/2026-06-05-cms-fase2-conteudo-design.md
git commit -m "docs(painel): criterios de aceite da Fase 2 verificados"
```

---

## Notas de escopo (Fora da Fase 2)

- Página de perfil individual de empresa no Guia (`/guia/[slug]`).
- Paywall/exclusividade em artigos.
- Dashboard com cards/gráficos, Home builder, Configurações, Usuários (Fase 3).
- Alteração do pipeline automático de notícias/eventos.
