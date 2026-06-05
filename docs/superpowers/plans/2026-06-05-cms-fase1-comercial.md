# CMS Fase 1 (Comercial) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar as 3 seções comerciais do painel (Publicidade, Classificados, Empresas em Destaque) de stubs em CRUD funcional com upload de imagens, e expor a vitrine de empresas em destaque no site.

**Architecture:** Reusa o shell e as permissões da Fase 0. Cada seção tem `actions.ts` (Server Actions que revalidam sessão + `podeAcessar` e gravam via service client), uma `page.tsx` server que busca os dados, e um client component que renderiza tabela + formulário em modal. Upload de imagens é feito no browser para o bucket `painel`. Empresas em Destaque ganha tabela própria e um bloco público na home.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase SSR (`@supabase/ssr`), Supabase Storage, TypeScript strict, Tailwind 3.4, lucide-react, react-hot-toast.

> **Verificação:** o projeto **não tem framework de testes** (zero cobertura — decisão registrada). Esta fase não introduz Jest/RTL (YAGNI). Portões: `npm run type-check`, `npm run build` e checagem manual no navegador contra os Critérios de Aceite. As migrations e a verificação e2e são aplicadas via MCP do Supabase (projeto `nsixodvejuhnsofpavvc`) ao final.

> **Referência:** spec `docs/superpowers/specs/2026-06-05-cms-fase1-comercial-design.md`. Padrão de upload existente: `app/(public)/classificados/novo/page.tsx`. Padrão de render público: `components/ui/BannerSlot.tsx`.

---

## Estrutura de Arquivos

**Criar:**
- `supabase/migrations/010_featured_companies.sql` — tabela `featured_companies` + RLS.
- `supabase/migrations/011_storage_painel.sql` — bucket `painel` + policies.
- `lib/painel/auth.ts` — helper `getPainelUser()` (sessão + role de painel) para Server Actions.
- `app/painel/publicidade/actions.ts`, `app/painel/publicidade/PublicidadeClient.tsx`.
- `app/painel/classificados/actions.ts`, `app/painel/classificados/ClassificadosClient.tsx`.
- `app/painel/destaques/actions.ts`, `app/painel/destaques/DestaquesClient.tsx`.
- `components/ui/EmpresasDestaque.tsx` — bloco público (Server Component).

**Modificar:**
- `types/database.ts` — adicionar tabela `featured_companies`.
- `components/painel/DataTable.tsx`, `Modal.tsx`, `FormField.tsx`, `ImageUpload.tsx` — upgrade dos esqueletos.
- `app/painel/publicidade/page.tsx`, `app/painel/classificados/page.tsx`, `app/painel/destaques/page.tsx` — trocar stub por CRUD.
- `app/(public)/page.tsx` — inserir `<EmpresasDestaque />`.

---

### Task 1: Migrations + tipos

**Files:**
- Create: `supabase/migrations/010_featured_companies.sql`, `supabase/migrations/011_storage_painel.sql`
- Modify: `types/database.ts` (adicionar `featured_companies` antes do fechamento `};` de `Tables`)

- [ ] **Step 1: Criar `010_featured_companies.sql`**

```sql
-- 010_featured_companies.sql — Fase 1: vitrine de empresas em destaque

CREATE TABLE IF NOT EXISTS public.featured_companies (
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

CREATE POLICY "featured_companies leitura publica"
  ON public.featured_companies FOR SELECT USING (true);

CREATE POLICY "featured_companies escrita painel"
  ON public.featured_companies FOR ALL
  USING (public.user_role() IN ('admin','comercial'))
  WITH CHECK (public.user_role() IN ('admin','comercial'));

CREATE INDEX IF NOT EXISTS idx_featured_companies_ativo
  ON public.featured_companies (ativo, ordem);
```

- [ ] **Step 2: Criar `011_storage_painel.sql`**

```sql
-- 011_storage_painel.sql — Fase 1: bucket de imagens do painel

INSERT INTO storage.buckets (id, name, public)
VALUES ('painel', 'painel', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "painel leitura publica"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'painel');

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

- [ ] **Step 3: Adicionar o tipo `featured_companies` em `types/database.ts`**

Inserir este bloco dentro de `Tables`, logo após o bloco `indicadores_config` (antes da linha que fecha `Tables` com `};`):

```typescript
      featured_companies: {
        Row: { id: number; name: string; logo_url: string | null; link: string | null; description: string | null; ordem: number; ativo: boolean; start_date: string | null; end_date: string | null; created_at: string };
        Insert: { name: string; logo_url?: string | null; link?: string | null; description?: string | null; ordem?: number; ativo?: boolean; start_date?: string | null; end_date?: string | null };
        Update: { name?: string; logo_url?: string | null; link?: string | null; description?: string | null; ordem?: number; ativo?: boolean; start_date?: string | null; end_date?: string | null };
      };
```

- [ ] **Step 4: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/010_featured_companies.sql supabase/migrations/011_storage_painel.sql types/database.ts
git commit -m "feat(painel): migrations featured_companies e bucket painel + tipos"
```

> As migrations são aplicadas no banco na Task 8 (junto da verificação e2e).

---

### Task 2: Guard de Server Action + upgrade DataTable e Modal

**Files:**
- Create: `lib/painel/auth.ts`
- Modify: `components/painel/DataTable.tsx`, `components/painel/Modal.tsx`

- [ ] **Step 1: Criar `lib/painel/auth.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";
import { rolePainel, podeAcessar, type Role, type Secao } from "./permissions";

/** Retorna o usuário de painel autenticado (id + role) ou null. */
export async function getPainelUser(): Promise<{ userId: string; role: Role } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).maybeSingle() as { data: { role: string } | null; error: unknown };
  const role = rolePainel(profile?.role);
  if (!role) return null;
  return { userId: user.id, role };
}

/** Garante que o usuário pode acessar a seção; lança erro se não. Use em Server Actions. */
export async function exigirSecao(secao: Secao): Promise<{ userId: string; role: Role }> {
  const u = await getPainelUser();
  if (!u || !podeAcessar(u.role, secao)) {
    throw new Error("Não autorizado");
  }
  return u;
}
```

- [ ] **Step 2: Atualizar `components/painel/DataTable.tsx` (coluna de ações)**

Substituir o conteúdo inteiro por (adiciona slot `acoes` por linha, mantém `Coluna<T>`):

```tsx
export interface Coluna<T> {
  chave: keyof T | string;
  titulo: string;
  render?: (linha: T) => React.ReactNode;
}

export default function DataTable<T extends { id: string | number }>({
  colunas,
  dados,
  acoes,
  vazio = "Nenhum registro.",
}: {
  colunas: Coluna<T>[];
  dados: T[];
  acoes?: (linha: T) => React.ReactNode;
  vazio?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
          <tr>
            {colunas.map((c) => (
              <th key={String(c.chave)} className="text-left px-6 py-3">{c.titulo}</th>
            ))}
            {acoes && <th className="px-6 py-3 text-right">Ações</th>}
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
              {acoes && <td className="px-6 py-4 text-right whitespace-nowrap">{acoes(linha)}</td>}
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

- [ ] **Step 3: Atualizar `components/painel/Modal.tsx` (ESC, backdrop, trava de scroll)**

Substituir o conteúdo inteiro por:

```tsx
"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    if (!aberto) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar?.();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aberto, onFechar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onFechar}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {titulo && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
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

- [ ] **Step 4: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/painel/auth.ts components/painel/DataTable.tsx components/painel/Modal.tsx
git commit -m "feat(painel): guard de server action + DataTable com acoes e Modal completo"
```

---

### Task 3: Upgrade FormField e ImageUpload

**Files:**
- Modify: `components/painel/FormField.tsx`, `components/painel/ImageUpload.tsx`

- [ ] **Step 1: Atualizar `components/painel/FormField.tsx`**

Substituir o conteúdo inteiro por (adiciona `Input`, `Textarea`, `Select` estilizados reusáveis junto do wrapper):

```tsx
export function FormField({
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

const baseInput =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={baseInput} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={baseInput} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={baseInput} />;
}

export default FormField;
```

- [ ] **Step 2: Atualizar `components/painel/ImageUpload.tsx`**

Substituir o conteúdo inteiro por (upload real para o bucket `painel`; **`onChange` agora é obrigatório**):

```tsx
"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

export default function ImageUpload({
  valor,
  onChange,
  label = "Imagem",
}: {
  valor?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
}) {
  const [enviando, setEnviando] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviando(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const ext = file.name.split(".").pop();
    const path = `${user?.id ?? "anon"}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("painel").upload(path, file, { contentType: file.type });
    setEnviando(false);
    if (error) { toast.error("Erro ao enviar imagem: " + error.message); return; }
    const { data } = supabase.storage.from("painel").getPublicUrl(path);
    onChange(data.publicUrl);
  }

  return (
    <div className="mb-4">
      <p className="block text-sm font-medium text-gray-700 mb-1">{label}</p>
      {valor ? (
        <div className="relative inline-block">
          <img src={valor} alt="" className="h-32 rounded-lg border border-gray-200 object-contain bg-gray-50" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-32 rounded-lg border-2 border-dashed border-gray-200 cursor-pointer hover:border-[#C9A84C] hover:bg-amber-50 transition-colors">
          <Upload size={20} className="text-gray-400 mb-2" />
          <span className="text-sm text-gray-500">{enviando ? "Enviando..." : "Clique para enviar"}</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={enviando} />
        </label>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add components/painel/FormField.tsx components/painel/ImageUpload.tsx
git commit -m "feat(painel): FormField com inputs e ImageUpload com upload real ao bucket painel"
```

---

### Task 4: Publicidade (CRUD de banners)

**Files:**
- Create: `app/painel/publicidade/actions.ts`, `app/painel/publicidade/PublicidadeClient.tsx`
- Modify: `app/painel/publicidade/page.tsx`

- [ ] **Step 1: Criar `app/painel/publicidade/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";

export interface AdInput {
  name: string;
  image_url: string | null;
  link: string | null;
  position: string;
  start_date: string | null;
  end_date: string | null;
}

export async function criarAd(input: AdInput) {
  await exigirSecao("publicidade");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("ads").insert(input);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/publicidade");
}

export async function atualizarAd(id: number, input: AdInput) {
  await exigirSecao("publicidade");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("ads").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/publicidade");
}

export async function excluirAd(id: number) {
  await exigirSecao("publicidade");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("ads").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/publicidade");
}
```

- [ ] **Step 2: Criar `app/painel/publicidade/PublicidadeClient.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DataTable from "@/components/painel/DataTable";
import Modal from "@/components/painel/Modal";
import { FormField, Input, Select } from "@/components/painel/FormField";
import ImageUpload from "@/components/painel/ImageUpload";
import Badge from "@/components/painel/Badge";
import { criarAd, atualizarAd, excluirAd, type AdInput } from "./actions";
import type { Database } from "@/types/database";

type Ad = Database["public"]["Tables"]["ads"]["Row"];

const POSICOES = ["top", "sidebar", "between", "footer"];

function vazio(): AdInput {
  return { name: "", image_url: null, link: null, position: "top", start_date: null, end_date: null };
}

function statusAd(a: Ad): { texto: string; variante: "sucesso" | "alerta" | "neutro" } {
  const hoje = new Date().toISOString().split("T")[0];
  if (a.start_date && a.start_date > hoje) return { texto: "Agendado", variante: "alerta" };
  if (a.end_date && a.end_date < hoje) return { texto: "Expirado", variante: "neutro" };
  return { texto: "Vigente", variante: "sucesso" };
}

export default function PublicidadeClient({ ads }: { ads: Ad[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<AdInput>(vazio());
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() {
    setEditId(null);
    setForm(vazio());
    setAberto(true);
  }

  function abrirEdicao(a: Ad) {
    setEditId(a.id);
    setForm({
      name: a.name ?? "",
      image_url: a.image_url,
      link: a.link,
      position: a.position ?? "top",
      start_date: a.start_date,
      end_date: a.end_date,
    });
    setAberto(true);
  }

  async function salvar() {
    if (!form.name) { toast.error("Nome obrigatório"); return; }
    setSalvando(true);
    try {
      if (editId) await atualizarAd(editId, form);
      else await criarAd(form);
      toast.success("Banner salvo");
      setAberto(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: number) {
    if (!confirm("Excluir este banner?")) return;
    try {
      await excluirAd(id);
      toast.success("Banner excluído");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={abrirNovo} className="bg-[#1A2B4A] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] transition-colors text-sm">
          + Novo banner
        </button>
      </div>

      <DataTable<Ad>
        dados={ads}
        vazio="Nenhum banner cadastrado."
        colunas={[
          { chave: "image_url", titulo: "Imagem", render: (a) => a.image_url ? <img src={a.image_url} alt="" className="h-10 rounded object-contain" /> : "—" },
          { chave: "name", titulo: "Nome" },
          { chave: "position", titulo: "Posição" },
          { chave: "vigencia", titulo: "Vigência", render: (a) => `${a.start_date ?? "—"} → ${a.end_date ?? "—"}` },
          { chave: "impressions", titulo: "Impr." },
          { chave: "clicks", titulo: "Cliques" },
          { chave: "status", titulo: "Status", render: (a) => { const s = statusAd(a); return <Badge variant={s.variante}>{s.texto}</Badge>; } },
        ]}
        acoes={(a) => (
          <div className="flex gap-3 justify-end">
            <button onClick={() => abrirEdicao(a)} className="text-blue-700 hover:text-blue-900 text-xs font-medium">Editar</button>
            <button onClick={() => remover(a.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Excluir</button>
          </div>
        )}
      />

      <Modal aberto={aberto} titulo={editId ? "Editar banner" : "Novo banner"} onFechar={() => setAberto(false)}>
        <ImageUpload label="Imagem do banner" valor={form.image_url} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />
        <FormField label="Nome">
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Banner home topo" />
        </FormField>
        <FormField label="Link">
          <Input value={form.link ?? ""} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value || null }))} placeholder="https://..." />
        </FormField>
        <FormField label="Posição">
          <Select value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}>
            {POSICOES.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Início">
            <Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value || null }))} />
          </FormField>
          <FormField label="Fim">
            <Input type="date" value={form.end_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value || null }))} />
          </FormField>
        </div>
        <button onClick={salvar} disabled={salvando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] transition-colors disabled:opacity-50">
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </Modal>
    </>
  );
}
```

- [ ] **Step 3: Substituir `app/painel/publicidade/page.tsx`**

Substituir o conteúdo inteiro (hoje é o stub) por:

```tsx
import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import PublicidadeClient from "./PublicidadeClient";
import type { Database } from "@/types/database";

type Ad = Database["public"]["Tables"]["ads"]["Row"];

export default async function PublicidadePage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "publicidade")) redirect("/painel");

  const supabase = await createClient();
  const { data: ads } = await supabase
    .from("ads").select("*").order("created_at", { ascending: false }) as { data: Ad[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader titulo="Publicidade" descricao="Banners e campanhas publicitárias do portal." />
      <PublicidadeClient ads={ads ?? []} />
    </div>
  );
}
```

- [ ] **Step 4: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/painel/publicidade
git commit -m "feat(painel): CRUD de Publicidade (banners) com upload e agendamento"
```

---

### Task 5: Classificados (moderação + CRUD)

**Files:**
- Create: `app/painel/classificados/actions.ts`, `app/painel/classificados/ClassificadosClient.tsx`
- Modify: `app/painel/classificados/page.tsx`

- [ ] **Step 1: Criar `app/painel/classificados/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";

export interface ClassificadoInput {
  title: string;
  description: string | null;
  price: number | null;
  category: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  whatsapp: string | null;
  status: string;
  expires_at: string | null;
}

export async function criarClassificado(input: ClassificadoInput) {
  const { userId } = await exigirSecao("classificados");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("classifieds").insert({ ...input, user_id: userId });
  if (error) throw new Error(error.message);
  revalidatePath("/painel/classificados");
}

export async function atualizarClassificado(id: number, input: ClassificadoInput) {
  await exigirSecao("classificados");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("classifieds").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/classificados");
}

export async function moderarClassificado(id: number, novoStatus: "active" | "rejected") {
  await exigirSecao("classificados");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("classifieds").update({ status: novoStatus }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/classificados");
}

export async function excluirClassificado(id: number) {
  await exigirSecao("classificados");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("classifieds").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/classificados");
}
```

- [ ] **Step 2: Criar `app/painel/classificados/ClassificadosClient.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DataTable from "@/components/painel/DataTable";
import Modal from "@/components/painel/Modal";
import { FormField, Input, Textarea, Select } from "@/components/painel/FormField";
import Badge from "@/components/painel/Badge";
import {
  criarClassificado, atualizarClassificado, moderarClassificado, excluirClassificado,
  type ClassificadoInput,
} from "./actions";
import type { Database } from "@/types/database";

type Classificado = Database["public"]["Tables"]["classifieds"]["Row"];

const STATUS_FILTROS = ["todos", "pending", "active", "rejected"] as const;
type Filtro = typeof STATUS_FILTROS[number];

const BADGE: Record<string, "sucesso" | "alerta" | "perigo" | "neutro"> = {
  active: "sucesso", pending: "alerta", rejected: "perigo",
};

function vazio(): ClassificadoInput {
  return { title: "", description: null, price: null, category: null, city: null, state: null, phone: null, whatsapp: null, status: "active", expires_at: null };
}

export default function ClassificadosClient({ itens }: { itens: Classificado[] }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ClassificadoInput>(vazio());
  const [salvando, setSalvando] = useState(false);

  const filtrados = itens.filter((c) =>
    (filtro === "todos" || c.status === filtro) &&
    (busca === "" || c.title.toLowerCase().includes(busca.toLowerCase()))
  );

  function abrirNovo() { setEditId(null); setForm(vazio()); setAberto(true); }
  function abrirEdicao(c: Classificado) {
    setEditId(c.id);
    setForm({
      title: c.title, description: c.description, price: c.price, category: c.category,
      city: c.city, state: c.state, phone: c.phone, whatsapp: c.whatsapp,
      status: c.status, expires_at: c.expires_at,
    });
    setAberto(true);
  }

  async function salvar() {
    if (!form.title) { toast.error("Título obrigatório"); return; }
    setSalvando(true);
    try {
      if (editId) await atualizarClassificado(editId, form);
      else await criarClassificado(form);
      toast.success("Classificado salvo");
      setAberto(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally { setSalvando(false); }
  }

  async function moderar(id: number, status: "active" | "rejected") {
    try { await moderarClassificado(id, status); toast.success("Atualizado"); router.refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function remover(id: number) {
    if (!confirm("Excluir este classificado?")) return;
    try { await excluirClassificado(id); toast.success("Excluído"); router.refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2">
          {STATUS_FILTROS.map((f) => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize ${filtro === f ? "bg-[#1A2B4A] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título..."
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]" />
          <button onClick={abrirNovo} className="bg-[#1A2B4A] text-white font-semibold px-4 py-1.5 rounded-lg hover:bg-[#0f1e35] text-sm">
            + Novo
          </button>
        </div>
      </div>

      <DataTable<Classificado>
        dados={filtrados}
        vazio="Nenhum classificado."
        colunas={[
          { chave: "title", titulo: "Título" },
          { chave: "category", titulo: "Categoria" },
          { chave: "city", titulo: "Cidade", render: (c) => c.city ? `${c.city}/${c.state ?? ""}` : "—" },
          { chave: "price", titulo: "Preço", render: (c) => c.price != null ? `R$ ${Number(c.price).toLocaleString("pt-BR")}` : "—" },
          { chave: "status", titulo: "Status", render: (c) => <Badge variant={BADGE[c.status] ?? "neutro"}>{c.status}</Badge> },
        ]}
        acoes={(c) => (
          <div className="flex gap-2 justify-end">
            {c.status !== "active" && <button onClick={() => moderar(c.id, "active")} className="text-green-700 hover:text-green-900 text-xs font-medium">Aprovar</button>}
            {c.status !== "rejected" && <button onClick={() => moderar(c.id, "rejected")} className="text-amber-700 hover:text-amber-900 text-xs font-medium">Rejeitar</button>}
            <button onClick={() => abrirEdicao(c)} className="text-blue-700 hover:text-blue-900 text-xs font-medium">Editar</button>
            <button onClick={() => remover(c.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Excluir</button>
          </div>
        )}
      />

      <Modal aberto={aberto} titulo={editId ? "Editar classificado" : "Novo classificado"} onFechar={() => setAberto(false)}>
        <FormField label="Título">
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </FormField>
        <FormField label="Descrição">
          <Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Preço (R$)">
            <Input type="number" value={form.price ?? ""} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value ? parseFloat(e.target.value) : null }))} />
          </FormField>
          <FormField label="Categoria">
            <Input value={form.category ?? ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value || null }))} />
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
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Telefone">
            <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value || null }))} />
          </FormField>
          <FormField label="WhatsApp">
            <Input value={form.whatsapp ?? ""} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value || null }))} />
          </FormField>
        </div>
        <FormField label="Status">
          <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="active">active</option>
            <option value="pending">pending</option>
            <option value="rejected">rejected</option>
          </Select>
        </FormField>
        <button onClick={salvar} disabled={salvando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </Modal>
    </>
  );
}
```

- [ ] **Step 3: Substituir `app/painel/classificados/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import ClassificadosClient from "./ClassificadosClient";
import type { Database } from "@/types/database";

type Classificado = Database["public"]["Tables"]["classifieds"]["Row"];

export default async function ClassificadosPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "classificados")) redirect("/painel");

  const supabase = await createClient();
  const { data: itens } = await supabase
    .from("classifieds").select("*").order("created_at", { ascending: false }) as { data: Classificado[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader titulo="Classificados" descricao="Anúncios classificados de máquinas, equipamentos e serviços." />
      <ClassificadosClient itens={itens ?? []} />
    </div>
  );
}
```

- [ ] **Step 4: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/painel/classificados
git commit -m "feat(painel): moderacao e CRUD de Classificados"
```

---

### Task 6: Empresas em Destaque (CRUD no painel)

**Files:**
- Create: `app/painel/destaques/actions.ts`, `app/painel/destaques/DestaquesClient.tsx`
- Modify: `app/painel/destaques/page.tsx`

- [ ] **Step 1: Criar `app/painel/destaques/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";

export interface DestaqueInput {
  name: string;
  logo_url: string | null;
  link: string | null;
  description: string | null;
  ordem: number;
  ativo: boolean;
  start_date: string | null;
  end_date: string | null;
}

export async function criarDestaque(input: DestaqueInput) {
  await exigirSecao("destaques");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("featured_companies").insert(input);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/destaques");
  revalidatePath("/");
}

export async function atualizarDestaque(id: number, input: DestaqueInput) {
  await exigirSecao("destaques");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("featured_companies").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/destaques");
  revalidatePath("/");
}

export async function excluirDestaque(id: number) {
  await exigirSecao("destaques");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("featured_companies").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/destaques");
  revalidatePath("/");
}
```

- [ ] **Step 2: Criar `app/painel/destaques/DestaquesClient.tsx`**

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
import { criarDestaque, atualizarDestaque, excluirDestaque, type DestaqueInput } from "./actions";
import type { Database } from "@/types/database";

type Destaque = Database["public"]["Tables"]["featured_companies"]["Row"];

function vazio(): DestaqueInput {
  return { name: "", logo_url: null, link: null, description: null, ordem: 0, ativo: true, start_date: null, end_date: null };
}

export default function DestaquesClient({ itens }: { itens: Destaque[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<DestaqueInput>(vazio());
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() { setEditId(null); setForm(vazio()); setAberto(true); }
  function abrirEdicao(d: Destaque) {
    setEditId(d.id);
    setForm({ name: d.name, logo_url: d.logo_url, link: d.link, description: d.description, ordem: d.ordem, ativo: d.ativo, start_date: d.start_date, end_date: d.end_date });
    setAberto(true);
  }

  async function salvar() {
    if (!form.name) { toast.error("Nome obrigatório"); return; }
    setSalvando(true);
    try {
      if (editId) await atualizarDestaque(editId, form);
      else await criarDestaque(form);
      toast.success("Empresa salva");
      setAberto(false);
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSalvando(false); }
  }

  async function remover(id: number) {
    if (!confirm("Excluir esta empresa?")) return;
    try { await excluirDestaque(id); toast.success("Excluída"); router.refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={abrirNovo} className="bg-[#1A2B4A] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] text-sm">
          + Nova empresa
        </button>
      </div>

      <DataTable<Destaque>
        dados={itens}
        vazio="Nenhuma empresa em destaque."
        colunas={[
          { chave: "logo_url", titulo: "Logo", render: (d) => d.logo_url ? <img src={d.logo_url} alt="" className="h-10 rounded object-contain" /> : "—" },
          { chave: "name", titulo: "Nome" },
          { chave: "ordem", titulo: "Ordem" },
          { chave: "vigencia", titulo: "Vigência", render: (d) => `${d.start_date ?? "—"} → ${d.end_date ?? "—"}` },
          { chave: "ativo", titulo: "Ativo", render: (d) => <Badge variant={d.ativo ? "sucesso" : "neutro"}>{d.ativo ? "Sim" : "Não"}</Badge> },
        ]}
        acoes={(d) => (
          <div className="flex gap-3 justify-end">
            <button onClick={() => abrirEdicao(d)} className="text-blue-700 hover:text-blue-900 text-xs font-medium">Editar</button>
            <button onClick={() => remover(d.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Excluir</button>
          </div>
        )}
      />

      <Modal aberto={aberto} titulo={editId ? "Editar empresa" : "Nova empresa"} onFechar={() => setAberto(false)}>
        <ImageUpload label="Logo" valor={form.logo_url} onChange={(url) => setForm((f) => ({ ...f, logo_url: url }))} />
        <FormField label="Nome">
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </FormField>
        <FormField label="Link">
          <Input value={form.link ?? ""} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value || null }))} placeholder="https://..." />
        </FormField>
        <FormField label="Descrição curta">
          <Textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Ordem">
            <Input type="number" value={form.ordem} onChange={(e) => setForm((f) => ({ ...f, ordem: parseInt(e.target.value) || 0 }))} />
          </FormField>
          <FormField label="Ativo">
            <label className="flex items-center gap-2 mt-2 text-sm">
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} />
              Exibir no site
            </label>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Início">
            <Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value || null }))} />
          </FormField>
          <FormField label="Fim">
            <Input type="date" value={form.end_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value || null }))} />
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

- [ ] **Step 3: Substituir `app/painel/destaques/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import DestaquesClient from "./DestaquesClient";
import type { Database } from "@/types/database";

type Destaque = Database["public"]["Tables"]["featured_companies"]["Row"];

export default async function DestaquesPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "destaques")) redirect("/painel");

  const supabase = await createClient();
  const { data: itens } = await supabase
    .from("featured_companies").select("*").order("ordem", { ascending: true }) as { data: Destaque[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader titulo="Empresas em Destaque" descricao="Empresas em destaque exibidas no portal." />
      <DestaquesClient itens={itens ?? []} />
    </div>
  );
}
```

- [ ] **Step 4: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/painel/destaques
git commit -m "feat(painel): CRUD de Empresas em Destaque"
```

---

### Task 7: Render público da vitrine na home

**Files:**
- Create: `components/ui/EmpresasDestaque.tsx`
- Modify: `app/(public)/page.tsx`

- [ ] **Step 1: Criar `components/ui/EmpresasDestaque.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Destaque = Database["public"]["Tables"]["featured_companies"]["Row"];

export async function EmpresasDestaque({ className }: { className?: string }) {
  const supabase = await createClient();
  const hoje = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("featured_companies")
    .select("id, name, logo_url, link, description")
    .eq("ativo", true)
    .or(`start_date.is.null,start_date.lte.${hoje}`)
    .or(`end_date.is.null,end_date.gte.${hoje}`)
    .order("ordem", { ascending: true })
    .limit(12) as { data: Pick<Destaque, "id" | "name" | "logo_url" | "link" | "description">[] | null; error: unknown };

  if (!data?.length) return null;

  return (
    <section className={className}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-6 bg-[#C9A84C] rounded" />
        <h2 className="text-lg font-bold text-[#1A2B4A] uppercase tracking-wide">Empresas em Destaque</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {data.map((e) => (
          <a
            key={e.id}
            href={e.link ?? "#"}
            target={e.link ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="group bg-white rounded-xl border border-gray-100 p-4 flex flex-col items-center text-center hover:border-[#C9A84C] hover:shadow-sm transition-all"
          >
            <div className="h-16 flex items-center justify-center mb-2">
              {e.logo_url
                ? <img src={e.logo_url} alt={e.name} className="max-h-16 object-contain" />
                : <span className="font-bold text-[#1A2B4A]">{e.name}</span>}
            </div>
            <p className="font-semibold text-sm text-[#1A2B4A] group-hover:text-[#C9A84C]">{e.name}</p>
            {e.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{e.description}</p>}
          </a>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Inserir `<EmpresasDestaque />` na home**

Em `app/(public)/page.tsx`:

1. Adicionar o import junto aos outros imports do topo (perto do `import { BannerSlot }`):

```tsx
import { EmpresasDestaque } from "@/components/ui/EmpresasDestaque";
```

2. Inserir o bloco logo após a abertura do container de conteúdo `<div className="max-w-7xl mx-auto px-4 pb-8">` (a linha que hoje precede `{/* CONTEÚDO PRINCIPAL + SIDEBAR */}`), antes do grid:

```tsx
    <div className="max-w-7xl mx-auto px-4 pb-8">

      <EmpresasDestaque className="mt-8" />

      {/* CONTEÚDO PRINCIPAL + SIDEBAR */}
```

- [ ] **Step 3: Verificar type-check + build**

Run: `npm run type-check && npm run build`
Expected: PASS; build conclui sem erros.

- [ ] **Step 4: Commit**

```bash
git add components/ui/EmpresasDestaque.tsx "app/(public)/page.tsx"
git commit -m "feat: vitrine publica de Empresas em Destaque na home"
```

---

### Task 8: Aplicar migrations + verificação end-to-end

**Files:** nenhum (DB + verificação).

- [ ] **Step 1: Aplicar as migrations no Supabase**

Aplicar `010_featured_companies.sql` e `011_storage_painel.sql` via MCP do Supabase (`apply_migration`, projeto `nsixodvejuhnsofpavvc`) ou pelo SQL Editor.

Verificar:
```sql
SELECT to_regclass('public.featured_companies') AS tabela;
SELECT id FROM storage.buckets WHERE id = 'painel';
```
Expected: `featured_companies` e bucket `painel` existem.

- [ ] **Step 2: Type-check + build finais**

Run: `npm run type-check && npm run build`
Expected: PASS.

- [ ] **Step 3: Verificação manual no navegador (logado como admin)**

Reiniciar `npm run dev` se necessário e verificar:
- **Publicidade:** criar banner com upload de imagem + posição `between` + datas que incluam hoje → aparece na lista como "Vigente"; visitar a home → o banner aparece no slot `between`; editar e excluir funcionam.
- **Classificados:** a lista mostra os filtros (todos/pending/active/rejected); criar manualmente um; aprovar/rejeitar muda o status e o badge; excluir remove.
- **Empresas em Destaque:** criar empresa com logo (upload), `ativo=true`, vigência incluindo hoje → aparece no bloco "Empresas em Destaque" na home; desativar (ou expirar) → some da home; editar/excluir funcionam.
- **Upload:** a imagem enviada abre pela URL pública (bucket `painel`).

- [ ] **Step 4: Marcar critérios de aceite na spec**

Em `docs/superpowers/specs/2026-06-05-cms-fase1-comercial-design.md`, marcar os checkboxes de "Critérios de Aceite (Fase 1)" verificados como `[x]`.

- [ ] **Step 5: Commit final**

```bash
git add docs/superpowers/specs/2026-06-05-cms-fase1-comercial-design.md
git commit -m "docs(painel): criterios de aceite da Fase 1 verificados"
```

---

## Notas de escopo (Fora da Fase 1)

- Guia Industrial, Vagas, Eventos, Colunistas + Artigos (Fase 2).
- Dashboard com cards/gráficos e Home builder drag-and-drop (Fase 3).
- Configurações e gestão de usuários funcionais (Fase 3).
- Checkout/monetização de banners e destaques (cadastro manual pela equipe).
- Relatórios/métricas avançadas de banners; `impressions`/`clicks` permanecem somente leitura.
