# CMS Fase 3 (Gestão) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a camada de gestão do CMS — Dashboard com métricas, Configurações do site, gestão de Usuários e o Home Builder drag-and-drop — encerrando o painel.

**Architecture:** Reusa o kit de componentes e o guard `lib/painel/auth.ts` das fases anteriores. Configurações e home viram orientadas a dados (tabelas `site_settings` e `home_blocks`); a home pública é refatorada em blocos renderizados conforme a config (com fallback). Dashboard usa `recharts`; Usuários usa a Admin API do Supabase para convites; Home Builder usa `@dnd-kit`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase SSR + Admin API, TypeScript strict, Tailwind 3.4, recharts, @dnd-kit, lucide-react, react-hot-toast.

> **Verificação:** sem framework de testes (decisão registrada). Portões: `npm run type-check`, `npm run build` e checagem manual. Migrations e e2e via MCP Supabase (projeto `nsixodvejuhnsofpavvc`) na Task 9. `SUPABASE_SERVICE_ROLE_KEY` já está configurado (local + Vercel).

> **Referência:** spec `docs/superpowers/specs/2026-06-05-cms-fase3-gestao-design.md`. Padrões: server actions das Fases 1–2 (`exigirSecao` + service client + cast `(supabase.from("x") as any)`); home atual `app/(public)/page.tsx`; `BannerSlot` (`components/ui/BannerSlot.tsx`); `ColunistasCarrossel`; `EmpresasDestaque` (`components/ui/EmpresasDestaque.tsx`).

---

## Estrutura de Arquivos

**Criar:**
- `supabase/migrations/015_site_settings.sql`, `016_home_blocks.sql`.
- `lib/settings.ts` — `getSettings()`.
- `app/painel/configuracoes/actions.ts`, `ConfiguracoesClient.tsx`.
- `app/painel/usuarios/actions.ts`, `UsuariosClient.tsx`.
- `app/painel/home/actions.ts`, `HomeBuilderClient.tsx`.
- `app/painel/DashboardCharts.tsx`.
- `components/home/Manchete.tsx`, `FaixaColunistas.tsx`, `GridNoticias.tsx`, `BannerBetween.tsx`, `MaisNoticias.tsx`, `BannerSidebar.tsx`, `MaisLidas.tsx`, `Newsletter.tsx`, `Assinar.tsx`, `CanaisRegionais.tsx`.
- `app/(public)/assinatura/AssinaturaClient.tsx`.

**Modificar:**
- `types/database.ts` — adicionar `site_settings`, `home_blocks`.
- `app/painel/page.tsx` — dashboard real.
- `app/painel/configuracoes/page.tsx`, `app/painel/usuarios/page.tsx`, `app/painel/home/page.tsx` — trocar stub por gestão.
- `app/(public)/page.tsx` — home orientada a blocos.
- `components/layout/Footer.tsx` — consumir settings.
- `app/(public)/assinatura/page.tsx` — virar server e passar preço ao client.
- `package.json` — `@dnd-kit/*`.

---

### Task 1: Migrations + tipos

**Files:**
- Create: `supabase/migrations/015_site_settings.sql`, `supabase/migrations/016_home_blocks.sql`
- Modify: `types/database.ts` (adicionar após `jobs`)

- [ ] **Step 1: Criar `015_site_settings.sql`**

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

- [ ] **Step 2: Criar `016_home_blocks.sql`**

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
  ('manchete',          'Manchete principal',   'full',    0, true),
  ('faixa_colunistas',  'Faixa de colunistas',  'full',    1, true),
  ('empresas_destaque', 'Empresas em destaque', 'full',    2, true),
  ('grid_noticias',     'Grade de notícias',    'main',    0, true),
  ('banner_between',    'Banner entre seções',  'main',    1, true),
  ('mais_noticias',     'Mais notícias',        'main',    2, true),
  ('banner_sidebar',    'Banner lateral',       'sidebar', 0, true),
  ('mais_lidas',        'Mais lidas',           'sidebar', 1, true),
  ('newsletter',        'Newsletter',           'sidebar', 2, true),
  ('assinar',           'Assine',               'sidebar', 3, true),
  ('canais_regionais',  'Canais regionais',     'sidebar', 4, true)
ON CONFLICT (key) DO NOTHING;
```

- [ ] **Step 3: Adicionar tipos em `types/database.ts`** (dentro de `Tables`, após o bloco `jobs`)

```typescript
      site_settings: {
        Row: { key: string; value: string | null };
        Insert: { key: string; value?: string | null };
        Update: { value?: string | null };
      };
      home_blocks: {
        Row: { id: number; key: string; label: string; coluna: "full" | "main" | "sidebar"; ordem: number; ativo: boolean };
        Insert: { key: string; label: string; coluna: "full" | "main" | "sidebar"; ordem?: number; ativo?: boolean };
        Update: { label?: string; coluna?: "full" | "main" | "sidebar"; ordem?: number; ativo?: boolean };
      };
```

- [ ] **Step 4: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/015_site_settings.sql supabase/migrations/016_home_blocks.sql types/database.ts
git commit -m "feat(painel): migrations site_settings e home_blocks + tipos"
```

> Migrations aplicadas na Task 9.

---

### Task 2: Instalar @dnd-kit

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Instalar as dependências**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
Expected: pacotes adicionados sem erros.

- [ ] **Step 2: Verificar build ainda compila**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: adiciona @dnd-kit para o home builder"
```

---

### Task 3: Configurações + consumo público

**Files:**
- Create: `lib/settings.ts`, `app/painel/configuracoes/actions.ts`, `app/painel/configuracoes/ConfiguracoesClient.tsx`
- Modify: `app/painel/configuracoes/page.tsx`, `components/layout/Footer.tsx`, `app/(public)/assinatura/page.tsx`
- Create: `app/(public)/assinatura/AssinaturaClient.tsx`

- [ ] **Step 1: Criar `lib/settings.ts`**

```typescript
import { createClient } from "@/lib/supabase/server";

export type Settings = Record<string, string>;

const PADROES: Settings = {
  site_name: "Portal MetalMecânica",
  contact_email: "",
  contact_phone: "",
  social_instagram: "",
  social_linkedin: "",
  social_youtube: "",
  subscription_price: "290",
};

export async function getSettings(): Promise<Settings> {
  const supabase = await createClient();
  const { data } = await supabase.from("site_settings").select("key, value") as
    { data: { key: string; value: string | null }[] | null; error: unknown };
  const out: Settings = { ...PADROES };
  for (const row of data ?? []) {
    if (row.value != null) out[row.key] = row.value;
  }
  return out;
}
```

- [ ] **Step 2: Criar `app/painel/configuracoes/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";

export async function salvarConfiguracoes(valores: Record<string, string>) {
  const { role } = await exigirSecao("configuracoes");
  if (role !== "admin") throw new Error("Não autorizado");
  const supabase = await createServiceClient();
  const linhas = Object.entries(valores).map(([key, value]) => ({ key, value }));
  const { error } = await (supabase.from("site_settings") as any).upsert(linhas, { onConflict: "key" });
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/assinatura");
  revalidatePath("/painel/configuracoes");
}
```

- [ ] **Step 3: Criar `app/painel/configuracoes/ConfiguracoesClient.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { FormField, Input } from "@/components/painel/FormField";
import { salvarConfiguracoes } from "./actions";

const CAMPOS: { key: string; label: string }[] = [
  { key: "site_name", label: "Nome do site" },
  { key: "contact_email", label: "E-mail de contato" },
  { key: "contact_phone", label: "Telefone de contato" },
  { key: "social_instagram", label: "Instagram (URL)" },
  { key: "social_linkedin", label: "LinkedIn (URL)" },
  { key: "social_youtube", label: "YouTube (URL)" },
  { key: "subscription_price", label: "Preço da assinatura mensal (R$)" },
];

export default function ConfiguracoesClient({ inicial }: { inicial: Record<string, string> }) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>(inicial);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await salvarConfiguracoes(form);
      toast.success("Configurações salvas");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-xl">
      {CAMPOS.map((c) => (
        <FormField key={c.key} label={c.label}>
          <Input value={form[c.key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [c.key]: e.target.value }))} />
        </FormField>
      ))}
      <button onClick={salvar} disabled={salvando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Substituir `app/painel/configuracoes/page.tsx`** por:

```tsx
import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { getSettings } from "@/lib/settings";
import SecaoHeader from "@/components/painel/SecaoHeader";
import ConfiguracoesClient from "./ConfiguracoesClient";

export default async function ConfiguracoesPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "configuracoes")) redirect("/painel");

  const settings = await getSettings();

  return (
    <div>
      <SecaoHeader titulo="Configurações" descricao="Configurações gerais do portal." />
      <ConfiguracoesClient inicial={settings} />
    </div>
  );
}
```

- [ ] **Step 5: Footer consome settings** — substituir `components/layout/Footer.tsx` por:

```tsx
import Link from "next/link";
import { BannerSlot } from "@/components/ui/BannerSlot";
import { getSettings } from "@/lib/settings";

export default async function Footer() {
  const s = await getSettings();
  const redes = [
    { url: s.social_instagram, label: "Instagram" },
    { url: s.social_linkedin, label: "LinkedIn" },
    { url: s.social_youtube, label: "YouTube" },
  ].filter((r) => r.url);

  return (
    <footer className="bg-[#1A2B4A] text-white mt-16">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <BannerSlot position="footer" />
      </div>
      <div className="h-1 bg-gradient-to-r from-[#C9A84C] via-[#e8c97a] to-[#C9A84C]" />
      <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <div className="mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Portal Metalmecânica" className="h-14 w-auto object-contain" />
          </div>
          <p className="text-blue-200 text-sm leading-relaxed">
            O portal de referência para profissionais do setor metalmecânico nos estados do ES e MG.
          </p>
        </div>

        <div>
          <h3 className="font-semibold mb-4 text-white">Navegação</h3>
          <ul className="space-y-2 text-sm text-blue-200">
            <li><Link href="/" className="hover:text-white transition-colors">Início</Link></li>
            <li><Link href="/noticias" className="hover:text-white transition-colors">Notícias</Link></li>
            <li><Link href="/classificados" className="hover:text-white transition-colors">Classificados</Link></li>
            <li><Link href="/assinatura" className="hover:text-white transition-colors">Assinar</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold mb-4 text-white">Contato</h3>
          <ul className="space-y-2 text-sm text-blue-200">
            <li>{s.contact_email || "contato@portalmetalmecanica.com.br"}</li>
            {s.contact_phone && <li>{s.contact_phone}</li>}
            <li>ES e MG — Brasil</li>
            {redes.length > 0 && (
              <li className="flex gap-3 pt-2">
                {redes.map((r) => (
                  <a key={r.label} href={r.url} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">{r.label}</a>
                ))}
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-[#C9A84C] px-4 py-4">
        <p className="text-center text-xs text-blue-300">
          © {new Date().getFullYear()} {s.site_name || "Portal Metalmecânica"}. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 6: Página de assinatura passa a injetar o preço** — renomear o componente client e criar a page server.

Primeiro, transformar o arquivo atual `app/(public)/assinatura/page.tsx` em client component `app/(public)/assinatura/AssinaturaClient.tsx`: mover **todo** o conteúdo atual para o novo arquivo, mudando a assinatura para aceitar `precoMensal`:

```tsx
// no topo permanece "use client"; ... imports ...
// trocar a constante PLANS para usar a prop:
export default function AssinaturaClient({ precoMensal }: { precoMensal: string }) {
  // ... resto do componente igual, mas a const PLANS vira:
  const PLANS = [
    {
      id: "monthly", label: "Mensal", price: `R$ ${precoMensal}`, period: "/mes",
      features: ["Acesso a todos os conteudos exclusivos", "Downloads de PDFs", "Newsletter premium", "Cancele quando quiser"],
    },
    {
      id: "yearly", label: "Anual", price: "R$ 2.490", period: "/ano", badge: "MELHOR VALOR",
      features: ["Tudo do plano mensal", "2 meses gratis", "Acesso antecipado a relatorios", "Suporte prioritario"],
    },
  ];
  // ... mantém handleCheckout e o JSX existentes ...
}
```

> Mantenha intacto o restante do componente original (estado, `handleCheckout`, JSX). Apenas: (1) renomeie a função para `AssinaturaClient` com a prop `precoMensal`, (2) mova `PLANS` para dentro da função usando `precoMensal` no `price` do plano mensal.

Depois, criar a nova `app/(public)/assinatura/page.tsx` (server):

```tsx
import { getSettings } from "@/lib/settings";
import AssinaturaClient from "./AssinaturaClient";

export default async function AssinaturaPage() {
  const s = await getSettings();
  return <AssinaturaClient precoMensal={s.subscription_price || "290"} />;
}
```

- [ ] **Step 7: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/settings.ts app/painel/configuracoes "app/(public)/assinatura" components/layout/Footer.tsx
git commit -m "feat(painel): Configuracoes + consumo de settings no Footer e assinatura"
```

---

### Task 4: Usuários

**Files:**
- Create: `app/painel/usuarios/actions.ts`, `app/painel/usuarios/UsuariosClient.tsx`
- Modify: `app/painel/usuarios/page.tsx`

- [ ] **Step 1: Criar `app/painel/usuarios/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getPainelUser, exigirSecao } from "@/lib/painel/auth";

export type PapelDB = "admin" | "editor" | "comercial" | "colunista" | "user";

export async function alterarPapel(userId: string, papel: PapelDB) {
  const { role, userId: meuId } = await exigirSecao("usuarios");
  if (role !== "admin") throw new Error("Não autorizado");
  if (userId === meuId && papel !== "admin") throw new Error("Você não pode rebaixar o próprio usuário.");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("profiles") as any).update({ role: papel }).eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/usuarios");
}

export async function convidarUsuario(email: string) {
  const u = await getPainelUser();
  if (!u || u.role !== "admin") throw new Error("Não autorizado");
  if (!email) throw new Error("Informe um e-mail");
  const supabase = await createServiceClient();
  const { error } = await supabase.auth.admin.inviteUserByEmail(email);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/usuarios");
}
```

- [ ] **Step 2: Criar `app/painel/usuarios/UsuariosClient.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DataTable from "@/components/painel/DataTable";
import Modal from "@/components/painel/Modal";
import { FormField, Input, Select } from "@/components/painel/FormField";
import { alterarPapel, convidarUsuario, type PapelDB } from "./actions";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const PAPEIS: PapelDB[] = ["admin", "editor", "comercial", "colunista", "user"];

export default function UsuariosClient({ usuarios, meuId }: { usuarios: Profile[]; meuId: string }) {
  const router = useRouter();
  const [convite, setConvite] = useState(false);
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function trocar(userId: string, papel: PapelDB) {
    try {
      await alterarPapel(userId, papel);
      toast.success("Papel atualizado");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function convidar() {
    setEnviando(true);
    try {
      await convidarUsuario(email);
      toast.success("Convite enviado");
      setConvite(false);
      setEmail("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao convidar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => setConvite(true)} className="bg-[#1A2B4A] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] text-sm">
          + Convidar usuário
        </button>
      </div>

      <DataTable<Profile>
        dados={usuarios}
        vazio="Nenhum usuário."
        colunas={[
          { chave: "name", titulo: "Nome", render: (p) => p.name ?? "—" },
          { chave: "email", titulo: "E-mail", render: (p) => p.email ?? "—" },
          {
            chave: "role", titulo: "Papel", render: (p) => (
              <Select value={p.role} onChange={(e) => trocar(p.id, e.target.value as PapelDB)}>
                {PAPEIS.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            ),
          },
        ]}
      />

      <Modal aberto={convite} titulo="Convidar usuário" onFechar={() => setConvite(false)}>
        <FormField label="E-mail">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@empresa.com" />
        </FormField>
        <button onClick={convidar} disabled={enviando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
          {enviando ? "Enviando..." : "Enviar convite"}
        </button>
      </Modal>
    </>
  );
}
```

- [ ] **Step 3: Substituir `app/painel/usuarios/page.tsx`** por:

```tsx
import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import UsuariosClient from "./UsuariosClient";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function UsuariosPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "usuarios")) redirect("/painel");

  const supabase = await createClient();
  const { data: usuarios } = await supabase
    .from("profiles").select("*").order("created_at", { ascending: true }) as { data: Profile[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader titulo="Usuários" descricao="Usuários e papéis de acesso ao painel." />
      <UsuariosClient usuarios={usuarios ?? []} meuId={u.userId} />
    </div>
  );
}
```

- [ ] **Step 4: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/painel/usuarios
git commit -m "feat(painel): gestao de Usuarios (trocar papel + convidar)"
```

---

### Task 5: Dashboard

**Files:**
- Create: `app/painel/DashboardCharts.tsx`
- Modify: `app/painel/page.tsx`

- [ ] **Step 1: Criar `app/painel/DashboardCharts.tsx`** (client, recharts)

```tsx
"use client";

import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export interface SeriePonto { label: string; valor: number; }

export default function DashboardCharts({
  assinantesPorMes,
  postsPorCategoria,
}: {
  assinantesPorMes: SeriePonto[];
  postsPorCategoria: SeriePonto[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Novos assinantes por mês</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={assinantesPorMes}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" fontSize={12} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip />
            <Area type="monotone" dataKey="valor" stroke="#1A2B4A" fill="#C9A84C" fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Notícias por categoria</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={postsPorCategoria}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" fontSize={12} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip />
            <Bar dataKey="valor" fill="#1A2B4A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Substituir `app/painel/page.tsx`** (dashboard real; mantém atalhos por papel)

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPainelUser } from "@/lib/painel/auth";
import { secoesDisponiveis, SECOES_META } from "@/lib/painel/permissions";
import DashboardCharts, { type SeriePonto } from "./DashboardCharts";

export default async function PainelDashboard() {
  const u = await getPainelUser();
  if (!u) redirect("/login?next=/painel");

  const supabase = await createClient();
  const agora = new Date().toISOString();

  async function conta(tabela: string, filtro?: (q: any) => any): Promise<number> {
    let q = (supabase.from(tabela) as any).select("*", { count: "exact", head: true });
    if (filtro) q = filtro(q);
    const { count } = await q;
    return count ?? 0;
  }

  const [assinantes, postsPub, classifPend, empresas, vagasAtivas, artigosPub] = await Promise.all([
    conta("subscriptions", (q: any) => q.eq("status", "active").gte("current_period_end", agora)),
    conta("posts", (q: any) => q.not("published_at", "is", null)),
    conta("classifieds", (q: any) => q.eq("status", "pending")),
    conta("companies", (q: any) => q.eq("ativo", true)),
    conta("jobs", (q: any) => q.eq("ativo", true)),
    conta("articles", (q: any) => q.not("published_at", "is", null)),
  ]);

  const cards = [
    { label: "Assinantes ativos", value: assinantes },
    { label: "Posts publicados", value: postsPub },
    { label: "Classificados pendentes", value: classifPend },
    { label: "Empresas no guia", value: empresas },
    { label: "Vagas ativas", value: vagasAtivas },
    { label: "Artigos publicados", value: artigosPub },
  ];

  // série: novos assinantes nos últimos 6 meses
  const { data: subs } = await supabase.from("subscriptions").select("created_at") as
    { data: { created_at: string }[] | null; error: unknown };
  const meses: SeriePonto[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "short" });
    const valor = (subs ?? []).filter((s) => (s.created_at ?? "").startsWith(chave)).length;
    meses.push({ label, valor });
  }

  // série: posts por categoria (top 6)
  const { data: postsCat } = await supabase.from("posts").select("category").not("category", "is", null) as
    { data: { category: string | null }[] | null; error: unknown };
  const contagem: Record<string, number> = {};
  for (const p of postsCat ?? []) {
    const c = p.category ?? "—";
    contagem[c] = (contagem[c] ?? 0) + 1;
  }
  const postsPorCategoria: SeriePonto[] = Object.entries(contagem)
    .sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, valor]) => ({ label, valor }));

  const atalhos = secoesDisponiveis(u.role).filter((s) => s !== "dashboard");

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A2B4A] mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className="text-2xl font-bold text-[#1A2B4A]">{c.value}</p>
          </div>
        ))}
      </div>

      <DashboardCharts assinantesPorMes={meses} postsPorCategoria={postsPorCategoria} />

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Atalhos</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {atalhos.map((secao) => {
          const meta = SECOES_META[secao];
          const Icone = meta.icone;
          return (
            <Link key={secao} href={meta.rota} className="group bg-white rounded-xl border border-gray-100 p-5 hover:border-[#C9A84C] hover:shadow-sm transition-all">
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

- [ ] **Step 3: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/painel/page.tsx app/painel/DashboardCharts.tsx
git commit -m "feat(painel): dashboard com cards e graficos (recharts)"
```

---

### Task 6: Componentes de bloco da home

Extrai cada seção da home atual para `components/home/`, recebendo dados por props. **Os componentes devem reproduzir o JSX/estilo atual da home** (`app/(public)/page.tsx`).

**Files:**
- Create: `components/home/Manchete.tsx`, `FaixaColunistas.tsx`, `GridNoticias.tsx`, `BannerBetween.tsx`, `MaisNoticias.tsx`, `BannerSidebar.tsx`, `MaisLidas.tsx`, `Newsletter.tsx`, `Assinar.tsx`, `CanaisRegionais.tsx`

- [ ] **Step 1: Criar `components/home/Manchete.tsx`**

```tsx
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["posts"]["Row"];

export default function Manchete({ destaque, secundarias }: { destaque?: Post; secundarias: Post[] }) {
  if (!destaque) return null;
  return (
    <section className="mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Link href={"/noticias/" + destaque.slug} className="lg:col-span-2 group relative rounded-xl overflow-hidden block">
          <div className="relative aspect-video bg-[#1A2B4A]">
            {destaque.featured_image ? (
              <img src={destaque.featured_image} alt={destaque.title} className="w-full h-full object-cover opacity-70 group-hover:opacity-80 transition-opacity" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#1A2B4A] to-[#0f1e35]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
            <div className="absolute bottom-0 left-0 p-6">
              {destaque.category && (
                <span className="bg-[#C9A84C] text-white text-xs font-bold px-2 py-1 rounded mb-3 inline-block uppercase tracking-wide">{destaque.category}</span>
              )}
              <h2 className="text-white text-2xl md:text-3xl font-bold leading-tight mb-2 group-hover:text-[#C9A84C] transition-colors">{destaque.title}</h2>
              {destaque.excerpt && <p className="text-gray-300 text-sm line-clamp-2">{destaque.excerpt}</p>}
              {destaque.published_at && (
                <p className="text-gray-400 text-xs mt-2">{format(new Date(destaque.published_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
              )}
            </div>
          </div>
        </Link>

        <div className="flex flex-col gap-3">
          {secundarias.map((post) => (
            <Link key={post.id} href={"/noticias/" + post.slug} className="group flex gap-3 bg-white rounded-lg border border-gray-100 p-3 hover:shadow-md transition-shadow">
              <div className="w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-gray-100">
                {post.featured_image ? (
                  <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-[#1A2B4A]/10 flex items-center justify-center text-xs text-gray-400 font-bold">PM</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {post.category && <span className="text-xs font-bold text-[#C9A84C] uppercase">{post.category}</span>}
                <h3 className="text-sm font-semibold text-gray-900 group-hover:text-[#1A2B4A] line-clamp-2 mt-0.5 leading-tight">{post.title}</h3>
                {post.published_at && (
                  <p className="text-xs text-gray-400 mt-1">{format(new Date(post.published_at), "dd/MM/yyyy", { locale: ptBR })}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-[#C9A84C] via-[#e8c97a] to-[#C9A84C] mt-8" />
    </section>
  );
}
```

- [ ] **Step 2: Criar `components/home/FaixaColunistas.tsx`** (move a lista `COLUNISTAS` pra cá)

```tsx
import ColunistasCarrossel from "@/components/ui/ColunistasCarrossel";

const COLUNISTAS = [
  { nome: "Ricardo Mendonça", slug: "ricardo-mendonca", especialidade: "Automação & Indústria 4.0", iniciais: "RM", cor: "bg-blue-700" },
  { nome: "Fernanda Castelo", slug: "fernanda-castelo", especialidade: "Gestão Industrial & Lean", iniciais: "FC", cor: "bg-amber-700" },
  { nome: "Carlos Drummond Neto", slug: "carlos-drummond-neto", especialidade: "Soldagem & Metalurgia", iniciais: "CD", cor: "bg-orange-700" },
  { nome: "Patrícia Sousa", slug: "patricia-sousa", especialidade: "Mercado & Investimentos", iniciais: "PS", cor: "bg-green-700" },
  { nome: "Marcos Vinicius Teixeira", slug: "marcos-vinicius-teixeira", especialidade: "Manutenção Preditiva", iniciais: "MV", cor: "bg-red-700" },
  { nome: "Juliana Faria", slug: "juliana-faria", especialidade: "ISO 9001 & Qualidade", iniciais: "JF", cor: "bg-purple-700" },
];

export default function FaixaColunistas() {
  return <ColunistasCarrossel colunistas={COLUNISTAS} />;
}
```

- [ ] **Step 3: Criar `components/home/GridNoticias.tsx`**

```tsx
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["posts"]["Row"];

export default function GridNoticias({ posts }: { posts: Post[] }) {
  if (posts.length === 0) return null;
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-6 bg-[#C9A84C] rounded" />
        <h2 className="text-lg font-bold text-[#1A2B4A] uppercase tracking-wide">Últimas Notícias</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {posts.map((post) => (
          <Link key={post.id} href={"/noticias/" + post.slug} className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
            <div className="aspect-video bg-gray-100 overflow-hidden">
              {post.featured_image ? (
                <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              ) : (
                <div className="w-full h-full bg-[#1A2B4A]/10 flex items-center justify-center font-bold text-gray-300 text-2xl">PM</div>
              )}
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-1">
                {post.category && <span className="text-xs font-bold text-[#C9A84C] uppercase">{post.category}</span>}
                {post.region && <span className="text-xs text-gray-400">· {post.region}</span>}
                {post.is_exclusive && <span className="text-xs bg-[#1A2B4A] text-white px-1.5 py-0.5 rounded font-bold">EXCLUSIVO</span>}
              </div>
              <h3 className="font-semibold text-gray-900 group-hover:text-[#1A2B4A] line-clamp-2 leading-tight">{post.title}</h3>
              {post.excerpt && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{post.excerpt}</p>}
              {post.published_at && (
                <p className="text-xs text-gray-400 mt-2">{format(new Date(post.published_at), "d 'de' MMMM", { locale: ptBR })}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Criar `components/home/BannerBetween.tsx`**

```tsx
import { BannerSlot } from "@/components/ui/BannerSlot";

export default function BannerBetween() {
  return <BannerSlot position="between" className="my-4" />;
}
```

- [ ] **Step 5: Criar `components/home/MaisNoticias.tsx`**

```tsx
import Link from "next/link";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["posts"]["Row"];

export default function MaisNoticias({ posts }: { posts: Post[] }) {
  if (posts.length === 0) return null;
  return (
    <section>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-6 bg-[#C9A84C] rounded" />
        <h2 className="text-lg font-bold text-[#1A2B4A] uppercase tracking-wide">Mais Notícias</h2>
      </div>
      <div className="space-y-3">
        {posts.map((post, i) => (
          <Link key={post.id} href={"/noticias/" + post.slug} className="group flex gap-4 bg-white rounded-lg border border-gray-100 p-3 hover:shadow-md transition-shadow">
            <span className="text-2xl font-black text-gray-100 w-8 flex-shrink-0 leading-none mt-1">{String(i + 1).padStart(2, "0")}</span>
            <div className="flex-1">
              {post.category && <span className="text-xs font-bold text-[#C9A84C] uppercase">{post.category}</span>}
              <h3 className="font-semibold text-gray-900 group-hover:text-[#1A2B4A] transition-colors line-clamp-2 text-sm mt-0.5">{post.title}</h3>
            </div>
            {post.featured_image && (
              <div className="w-16 h-16 flex-shrink-0 rounded-md overflow-hidden">
                <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover" />
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Criar `components/home/BannerSidebar.tsx`**

```tsx
import { BannerSlot } from "@/components/ui/BannerSlot";

export default function BannerSidebar() {
  return <BannerSlot position="sidebar" className="mb-6" />;
}
```

- [ ] **Step 7: Criar `components/home/MaisLidas.tsx`**

```tsx
import Link from "next/link";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["posts"]["Row"];

export default function MaisLidas({ posts }: { posts: Post[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="bg-[#1A2B4A] px-4 py-3 flex items-center gap-2">
        <div className="w-1 h-5 bg-[#C9A84C] rounded" />
        <h3 className="text-white font-bold text-sm uppercase tracking-wide">Mais Lidas</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {posts.map((post, i) => (
          <Link key={post.id} href={"/noticias/" + post.slug} className="group flex gap-3 p-3 hover:bg-gray-50 transition-colors">
            <span className="text-2xl font-black text-gray-100 w-6 flex-shrink-0 leading-none">{i + 1}</span>
            <div>
              {post.category && <span className="text-xs font-bold text-[#C9A84C] uppercase">{post.category}</span>}
              <h4 className="text-sm font-medium text-gray-800 group-hover:text-[#1A2B4A] line-clamp-2 leading-tight mt-0.5">{post.title}</h4>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Criar `components/home/Newsletter.tsx`**

```tsx
export default function Newsletter() {
  return (
    <div className="bg-[#1A2B4A] rounded-xl p-5 text-white">
      <h3 className="font-bold text-lg mb-1">Newsletter</h3>
      <p className="text-blue-200 text-sm mb-4">Receba as principais notícias industriais toda semana.</p>
      <input type="email" placeholder="seu@email.com" className="w-full px-3 py-2 rounded-lg text-gray-900 text-sm mb-2 focus:outline-none" />
      <button className="w-full bg-[#C9A84C] text-white font-bold py-2 rounded-lg hover:bg-[#b8973e] transition-colors text-sm">Inscrever-se</button>
    </div>
  );
}
```

- [ ] **Step 9: Criar `components/home/Assinar.tsx`**

```tsx
import Link from "next/link";

export default function Assinar({ preco }: { preco: string }) {
  return (
    <div className="bg-gradient-to-br from-[#C9A84C] to-[#b8973e] rounded-xl p-5 text-white">
      <h3 className="font-bold text-lg mb-1">Seja Assinante</h3>
      <p className="text-white/80 text-sm mb-4">Acesse conteúdos exclusivos do setor metalmecânico.</p>
      <div className="text-2xl font-black mb-1">R$ {preco}<span className="text-sm font-normal">/mês</span></div>
      <Link href="/assinatura" className="block w-full bg-[#1A2B4A] text-white font-bold py-2 rounded-lg hover:bg-[#0f1e35] transition-colors text-sm text-center mt-3">Assinar agora</Link>
    </div>
  );
}
```

- [ ] **Step 10: Criar `components/home/CanaisRegionais.tsx`**

```tsx
import Link from "next/link";

export default function CanaisRegionais() {
  const canais = [
    { label: "Espírito Santo", href: "/noticias/es", flag: "🏭" },
    { label: "Minas Gerais", href: "/noticias/mg", flag: "⚙️" },
    { label: "Brasil Industrial", href: "/noticias/brasil", flag: "🇧🇷" },
  ];
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="bg-[#1A2B4A] px-4 py-3 flex items-center gap-2">
        <div className="w-1 h-5 bg-[#C9A84C] rounded" />
        <h3 className="text-white font-bold text-sm uppercase tracking-wide">Canais Regionais</h3>
      </div>
      <div className="p-3 space-y-2">
        {canais.map((canal) => (
          <Link key={canal.href} href={canal.href} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors group">
            <span className="text-lg">{canal.flag}</span>
            <span className="text-sm font-medium text-gray-700 group-hover:text-[#1A2B4A]">{canal.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 11: Verificar type-check**

Run: `npm run type-check`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add components/home
git commit -m "feat(home): extrai secoes da home em componentes de bloco"
```

---

### Task 7: Home pública orientada a blocos

**Files:**
- Modify: `app/(public)/page.tsx`

- [ ] **Step 1: Reescrever `app/(public)/page.tsx`** para montar os blocos a partir de `home_blocks`

```tsx
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import Manchete from "@/components/home/Manchete";
import FaixaColunistas from "@/components/home/FaixaColunistas";
import { EmpresasDestaque } from "@/components/ui/EmpresasDestaque";
import GridNoticias from "@/components/home/GridNoticias";
import BannerBetween from "@/components/home/BannerBetween";
import MaisNoticias from "@/components/home/MaisNoticias";
import BannerSidebar from "@/components/home/BannerSidebar";
import MaisLidas from "@/components/home/MaisLidas";
import Newsletter from "@/components/home/Newsletter";
import Assinar from "@/components/home/Assinar";
import CanaisRegionais from "@/components/home/CanaisRegionais";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["posts"]["Row"];
type Bloco = Database["public"]["Tables"]["home_blocks"]["Row"];

export const revalidate = 300;

const ORDEM_PADRAO: Pick<Bloco, "key" | "coluna" | "ordem" | "ativo">[] = [
  { key: "manchete", coluna: "full", ordem: 0, ativo: true },
  { key: "faixa_colunistas", coluna: "full", ordem: 1, ativo: true },
  { key: "empresas_destaque", coluna: "full", ordem: 2, ativo: true },
  { key: "grid_noticias", coluna: "main", ordem: 0, ativo: true },
  { key: "banner_between", coluna: "main", ordem: 1, ativo: true },
  { key: "mais_noticias", coluna: "main", ordem: 2, ativo: true },
  { key: "banner_sidebar", coluna: "sidebar", ordem: 0, ativo: true },
  { key: "mais_lidas", coluna: "sidebar", ordem: 1, ativo: true },
  { key: "newsletter", coluna: "sidebar", ordem: 2, ativo: true },
  { key: "assinar", coluna: "sidebar", ordem: 3, ativo: true },
  { key: "canais_regionais", coluna: "sidebar", ordem: 4, ativo: true },
];

export default async function HomePage() {
  const supabase = await createClient();

  const { data: posts } = await supabase
    .from("posts").select("*").not("published_at", "is", null).neq("category", "Legislacao")
    .order("published_at", { ascending: false }).limit(20) as { data: Post[] | null; error: unknown };

  const { data: blocosDb } = await supabase
    .from("home_blocks").select("*").eq("ativo", true).order("ordem", { ascending: true }) as { data: Bloco[] | null; error: unknown };

  const settings = await getSettings();

  const lista = (blocosDb && blocosDb.length > 0 ? blocosDb : ORDEM_PADRAO) as Pick<Bloco, "key" | "coluna" | "ordem" | "ativo">[];
  const ativos = lista.filter((b) => b.ativo);

  const destaque = posts?.[0];
  const secundarias = posts?.slice(1, 4) ?? [];
  const grid = posts?.slice(4, 10) ?? [];
  const maisLidas = posts?.slice(0, 6) ?? [];
  const ultimasNoticias = posts?.slice(10, 16) ?? [];

  const COMPONENTES: Record<string, React.ReactNode> = {
    manchete: <Manchete destaque={destaque} secundarias={secundarias} />,
    faixa_colunistas: <FaixaColunistas />,
    empresas_destaque: <EmpresasDestaque />,
    grid_noticias: <GridNoticias posts={grid} />,
    banner_between: <BannerBetween />,
    mais_noticias: <MaisNoticias posts={ultimasNoticias} />,
    banner_sidebar: <BannerSidebar />,
    mais_lidas: <MaisLidas posts={maisLidas} />,
    newsletter: <Newsletter />,
    assinar: <Assinar preco={settings.subscription_price || "290"} />,
    canais_regionais: <CanaisRegionais />,
  };

  const porColuna = (col: "full" | "main" | "sidebar") =>
    ativos.filter((b) => b.coluna === col).sort((a, b) => a.ordem - b.ordem);

  const full = porColuna("full");
  const main = porColuna("main");
  const sidebar = porColuna("sidebar");

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 pt-6">
        {full.map((b) => <div key={b.key}>{COMPONENTES[b.key]}</div>)}
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          <div className="lg:col-span-2 space-y-8">
            {main.map((b) => <div key={b.key}>{COMPONENTES[b.key]}</div>)}
          </div>
          <aside className="space-y-6">
            {sidebar.map((b) => <div key={b.key}>{COMPONENTES[b.key]}</div>)}
          </aside>
        </div>
      </div>
    </>
  );
}
```

> Nota: `faixa_colunistas` e `empresas_destaque` estão na coluna `full`; ficam renderizadas dentro do container `max-w-7xl` (a faixa de colunistas, que antes era full-bleed, passa a respeitar a largura do container — comportamento aceitável e consistente com o builder).

- [ ] **Step 2: Verificar type-check + build**

Run: `npm run type-check && npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/page.tsx"
git commit -m "feat(home): home publica orientada a home_blocks com fallback"
```

---

### Task 8: Home Builder (painel)

**Files:**
- Create: `app/painel/home/actions.ts`, `app/painel/home/HomeBuilderClient.tsx`
- Modify: `app/painel/home/page.tsx`

- [ ] **Step 1: Criar `app/painel/home/actions.ts`**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";

export interface BlocoUpdate {
  id: number;
  ordem: number;
  ativo: boolean;
}

export async function salvarLayout(blocos: BlocoUpdate[]) {
  await exigirSecao("home");
  const supabase = await createServiceClient();
  for (const b of blocos) {
    const { error } = await (supabase.from("home_blocks") as any)
      .update({ ordem: b.ordem, ativo: b.ativo }).eq("id", b.id);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/painel/home");
  revalidatePath("/");
}
```

- [ ] **Step 2: Criar `app/painel/home/HomeBuilderClient.tsx`** (3 listas ordenáveis com @dnd-kit)

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { salvarLayout } from "./actions";
import type { Database } from "@/types/database";

type Bloco = Database["public"]["Tables"]["home_blocks"]["Row"];
type Coluna = "full" | "main" | "sidebar";

const TITULOS: Record<Coluna, string> = {
  full: "Largura total (topo)",
  main: "Coluna principal",
  sidebar: "Barra lateral",
};

function Item({ bloco, onToggle }: { bloco: Bloco; onToggle: (id: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: bloco.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg px-3 py-2">
      <button {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600" aria-label="Arrastar">
        <GripVertical className="w-4 h-4" />
      </button>
      <span className={`flex-1 text-sm ${bloco.ativo ? "text-gray-800" : "text-gray-400 line-through"}`}>{bloco.label}</span>
      <label className="flex items-center gap-1.5 text-xs text-gray-500">
        <input type="checkbox" checked={bloco.ativo} onChange={() => onToggle(bloco.id)} />
        Ativo
      </label>
    </div>
  );
}

function Lista({ coluna, blocos, setBlocos }: { coluna: Coluna; blocos: Bloco[]; setBlocos: (fn: (prev: Bloco[]) => Bloco[]) => void }) {
  const doColuna = blocos.filter((b) => b.coluna === coluna).sort((a, b) => a.ordem - b.ordem);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = doColuna.map((b) => b.id);
    const from = ids.indexOf(Number(active.id));
    const to = ids.indexOf(Number(over.id));
    const reordenados = arrayMove(doColuna, from, to);
    setBlocos((prev) => prev.map((b) => {
      const idx = reordenados.findIndex((r) => r.id === b.id);
      return idx >= 0 ? { ...b, ordem: idx } : b;
    }));
  }

  function toggle(id: number) {
    setBlocos((prev) => prev.map((b) => (b.id === id ? { ...b, ativo: !b.ativo } : b)));
  }

  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <h3 className="text-sm font-bold text-[#1A2B4A] mb-3">{TITULOS[coluna]}</h3>
      <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={doColuna.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {doColuna.map((b) => <Item key={b.id} bloco={b} onToggle={toggle} />)}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export default function HomeBuilderClient({ inicial }: { inicial: Bloco[] }) {
  const router = useRouter();
  const [blocos, setBlocos] = useState<Bloco[]>(inicial);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await salvarLayout(blocos.map((b) => ({ id: b.id, ordem: b.ordem, ativo: b.ativo })));
      toast.success("Layout salvo");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {(["full", "main", "sidebar"] as Coluna[]).map((col) => (
          <Lista key={col} coluna={col} blocos={blocos} setBlocos={setBlocos} />
        ))}
      </div>
      <button onClick={salvar} disabled={salvando} className="bg-[#1A2B4A] text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
        {salvando ? "Salvando..." : "Salvar layout"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Substituir `app/painel/home/page.tsx`** por:

```tsx
import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { createClient } from "@/lib/supabase/server";
import SecaoHeader from "@/components/painel/SecaoHeader";
import HomeBuilderClient from "./HomeBuilderClient";
import type { Database } from "@/types/database";

type Bloco = Database["public"]["Tables"]["home_blocks"]["Row"];

export default async function HomeBuilderPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "home")) redirect("/painel");

  const supabase = await createClient();
  const { data: blocos } = await supabase
    .from("home_blocks").select("*").order("ordem", { ascending: true }) as { data: Bloco[] | null; error: unknown };

  return (
    <div>
      <SecaoHeader titulo="Home" descricao="Arraste para reordenar e ative/desative os blocos da home." />
      <HomeBuilderClient inicial={blocos ?? []} />
    </div>
  );
}
```

- [ ] **Step 4: Verificar type-check + build**

Run: `npm run type-check && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/painel/home
git commit -m "feat(painel): Home Builder drag-and-drop (@dnd-kit)"
```

---

### Task 9: Aplicar migrations + verificação end-to-end

**Files:** nenhum (DB + verificação).

- [ ] **Step 1: Aplicar as migrations no Supabase**

Aplicar `015_site_settings.sql` e `016_home_blocks.sql` via MCP (`apply_migration`, projeto `nsixodvejuhnsofpavvc`).

Verificar:
```sql
SELECT (SELECT count(*) FROM public.site_settings) AS settings,
       (SELECT count(*) FROM public.home_blocks) AS blocks;
```
Expected: `settings` = 7, `blocks` = 11.

- [ ] **Step 2: Type-check + build finais**

Run: `npm run type-check && npm run build`
Expected: PASS.

- [ ] **Step 3: Verificação manual (logado como admin)**

- **Dashboard:** `/painel` mostra 6 cards com números e os 2 gráficos.
- **Configurações:** alterar nome/contato/redes/preço e salvar; recarregar `/` (Footer com contato/redes) e `/assinatura` (preço refletido).
- **Usuários:** trocar o papel de um usuário (persiste ao recarregar); tentar rebaixar o próprio usuário admin → erro; convidar um e-mail de teste → toast de sucesso (verificar e-mail/registro de convite no Supabase Auth).
- **Home Builder:** em `/painel/home`, arrastar para reordenar e desativar um bloco; salvar; abrir `/` e confirmar a nova ordem e o bloco oculto.
- **Home:** a home renderiza normalmente; (sanidade) renomear/desativar `home_blocks` temporariamente não quebra a página.

- [ ] **Step 4: Marcar critérios de aceite na spec**

Em `docs/superpowers/specs/2026-06-05-cms-fase3-gestao-design.md`, marcar os checkboxes verificados como `[x]`.

- [ ] **Step 5: Commit final**

```bash
git add docs/superpowers/specs/2026-06-05-cms-fase3-gestao-design.md
git commit -m "docs(painel): criterios de aceite da Fase 3 verificados"
```

---

## Notas de escopo (Fora da Fase 3)

- Editar conteúdo interno dos blocos pelo builder (só ordem/visibilidade).
- Criar/remover tipos de bloco (catálogo fixo).
- Edição de e-mail/senha de usuários (só papel + convite).
- Métricas avançadas/exportação no dashboard.
- Mover blocos entre colunas no builder.
