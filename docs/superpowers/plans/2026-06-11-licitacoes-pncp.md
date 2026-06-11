# Licitações PNCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar seção `/licitacoes` que exibe licitações públicas federais relevantes ao setor metalmecânico de ES e MG, buscadas automaticamente do PNCP via cron diário e armazenadas no Supabase.

**Architecture:** Cron diário chama `pncp.gov.br/api/consulta/v1/contratacoes/publicacao` para ES e MG (últimos 30 dias), filtra por palavras-chave de metalmecanica no campo `objeto`, faz upsert no Supabase. A página pública lê do banco com `revalidate = 300` e aplica filtros de UF e status via `searchParams`.

**Tech Stack:** Next.js App Router (Server Components), Supabase (Postgres + RLS), PNCP API REST pública, `@vercel/functions` (waitUntil), TypeScript.

---

### Task 1: Tabela no Supabase + tipos TypeScript

**Files:**
- Modify: `types/database.ts`

- [ ] **Aplicar SQL no Supabase** (dashboard → SQL Editor ou MCP `execute_sql`):

```sql
create table if not exists public.licitacoes_pncp (
  id                  text        primary key,
  orgao_cnpj          text        not null,
  orgao_nome          text,
  uf                  text        not null,
  objeto              text,
  modalidade          text,
  valor_estimado      numeric,
  data_publicacao     date,
  data_encerramento   date,
  status              text        not null default 'aberta',
  link_pncp           text,
  updated_at          timestamptz not null default now()
);

create index if not exists licitacoes_pncp_uf_idx     on public.licitacoes_pncp (uf);
create index if not exists licitacoes_pncp_status_idx on public.licitacoes_pncp (status);
create index if not exists licitacoes_pncp_enc_idx    on public.licitacoes_pncp (data_encerramento desc nulls last);

alter table public.licitacoes_pncp enable row level security;

create policy "licitacoes leitura publica"
  on public.licitacoes_pncp for select using (true);
```

- [ ] **Adicionar o tipo** em `types/database.ts`, dentro do bloco `Tables: {`, após a entrada `jobs`:

```ts
      licitacoes_pncp: {
        Row: {
          id: string;
          orgao_cnpj: string;
          orgao_nome: string | null;
          uf: string;
          objeto: string | null;
          modalidade: string | null;
          valor_estimado: number | null;
          data_publicacao: string | null;
          data_encerramento: string | null;
          status: string;
          link_pncp: string | null;
          updated_at: string;
        };
        Insert: {
          id: string;
          orgao_cnpj: string;
          orgao_nome?: string | null;
          uf: string;
          objeto?: string | null;
          modalidade?: string | null;
          valor_estimado?: number | null;
          data_publicacao?: string | null;
          data_encerramento?: string | null;
          status?: string;
          link_pncp?: string | null;
          updated_at?: string;
        };
        Update: {
          orgao_nome?: string | null;
          uf?: string;
          objeto?: string | null;
          modalidade?: string | null;
          valor_estimado?: number | null;
          data_publicacao?: string | null;
          data_encerramento?: string | null;
          status?: string;
          link_pncp?: string | null;
          updated_at?: string;
        };
      };
```

- [ ] **Commit**

```bash
git add types/database.ts
git commit -m "feat(db): tipo licitacoes_pncp no database.ts"
```

---

### Task 2: Cron — busca, filtragem e upsert

**Files:**
- Create: `app/api/cron/licitacoes/route.ts`

**Lógica:**
1. Para cada UF (`ES`, `MG`), chama o PNCP paginando até esgotar (`tamanhoPagina=50`).
2. Filtra licitações cujo `objeto` contenha ao menos uma palavra-chave de metalmecanica.
3. Determina `status` pelo `data_encerramento` vs hoje.
4. Upsert em lotes.
5. Ao final, atualiza para `encerrada` qualquer licitação `aberta` com `data_encerramento` passada.
6. Tudo roda dentro de `waitUntil` (não bloqueia o handler).

- [ ] **Criar `app/api/cron/licitacoes/route.ts`**:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@supabase/supabase-js';

const PNCP_CONSULTA = 'https://pncp.gov.br/api/consulta/v1';
const PAGE_SIZE = 50;
const UFS = ['ES', 'MG'] as const;

const PALAVRAS_METALMEC = [
  'aço', 'aco', 'alumínio', 'aluminio', 'cobre', 'ferro', 'metal', 'metalúrgi', 'metalurgi',
  'tubo', 'tubulação', 'tubulacao', 'caldeira', 'compressor', 'soldagem', 'solda',
  'usinagem', 'fundição', 'fundicao', 'estampagem', 'ferrament',
  'estrutura metálica', 'estrutura metalica', 'chapa metálica', 'chapa metalica',
  'torno', 'fresadora', 'máquina industrial', 'maquina industrial', 'equipamento industrial',
];

interface PncpContratacao {
  orgaoEntidade: { cnpj: string; razaoSocial: string; ufSigla: string };
  objeto: string;
  modalidadeName: string;
  valorTotalEstimado: number | null;
  dataPublicacaoPncp: string;
  dataEncerramentoProposta: string | null;
  anoCompra: number;
  sequencialCompra: number;
  linkSistemaOrigem: string | null;
}

interface PncpPage {
  data: PncpContratacao[];
  totalPaginas: number;
  empty: boolean;
}

function isAutorizado(req: NextRequest): boolean {
  return (
    req.headers.get('x-vercel-cron') === '1' ||
    req.nextUrl.searchParams.get('secret') === process.env.CRON_SECRET
  );
}

function isMetalmec(objeto: string): boolean {
  const obj = objeto.toLowerCase();
  return PALAVRAS_METALMEC.some((p) => obj.includes(p));
}

function calcStatus(dataEncerramento: string | null): 'aberta' | 'encerrada' {
  if (!dataEncerramento) return 'aberta';
  return new Date(dataEncerramento) >= new Date() ? 'aberta' : 'encerrada';
}

async function fetchPagina(uf: string, dataInicial: string, dataFinal: string, pagina: number): Promise<PncpPage> {
  const params = new URLSearchParams({
    uf, dataInicial, dataFinal,
    pagina: String(pagina),
    tamanhoPagina: String(PAGE_SIZE),
  });
  const res = await fetch(`${PNCP_CONSULTA}/contratacoes/publicacao?${params}`, {
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok) throw new Error(`PNCP ${uf} p${pagina}: HTTP ${res.status}`);
  return res.json() as Promise<PncpPage>;
}

async function executarSync() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const hoje = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const dataFinal   = fmt(hoje);
  const dataInicial = fmt(new Date(hoje.getTime() - 30 * 24 * 60 * 60 * 1000));

  let totalFiltradas = 0;
  let upsertados = 0;
  let erros = 0;

  for (const uf of UFS) {
    let pagina = 1;
    let totalPaginas = 1;

    while (pagina <= totalPaginas) {
      try {
        const page = await fetchPagina(uf, dataInicial, dataFinal, pagina);
        if (page.empty || !page.data?.length) break;
        totalPaginas = page.totalPaginas ?? 1;

        const filtradas = page.data.filter((c) => isMetalmec(c.objeto ?? ''));
        totalFiltradas += filtradas.length;

        const registros = filtradas.map((c) => ({
          id: `${c.orgaoEntidade.cnpj}-${c.anoCompra}-${c.sequencialCompra}`,
          orgao_cnpj: c.orgaoEntidade.cnpj,
          orgao_nome: c.orgaoEntidade.razaoSocial ?? null,
          uf: c.orgaoEntidade.ufSigla ?? uf,
          objeto: c.objeto ?? null,
          modalidade: c.modalidadeName ?? null,
          valor_estimado: c.valorTotalEstimado ?? null,
          data_publicacao: c.dataPublicacaoPncp?.slice(0, 10) ?? null,
          data_encerramento: c.dataEncerramentoProposta?.slice(0, 10) ?? null,
          status: calcStatus(c.dataEncerramentoProposta),
          link_pncp: c.linkSistemaOrigem ?? null,
          updated_at: new Date().toISOString(),
        }));

        if (registros.length > 0) {
          const { error } = await supabase
            .from('licitacoes_pncp')
            .upsert(registros, { onConflict: 'id' });
          if (error) { console.error('[licitacoes] upsert erro:', error.message); erros++; }
          else upsertados += registros.length;
        }
      } catch (err) {
        console.error(`[licitacoes] erro uf=${uf} p=${pagina}:`, err);
        erros++;
        break;
      }
      pagina++;
    }
  }

  // Marcar como encerradas licitações com prazo vencido
  const { error: errStatus } = await supabase
    .from('licitacoes_pncp')
    .update({ status: 'encerrada', updated_at: new Date().toISOString() })
    .eq('status', 'aberta')
    .lt('data_encerramento', new Date().toISOString().slice(0, 10));
  if (errStatus) console.error('[licitacoes] status update erro:', errStatus.message);

  console.log(`[licitacoes] filtradas=${totalFiltradas} upsertados=${upsertados} erros=${erros}`);
  return { totalFiltradas, upsertados, erros };
}

export async function GET(req: NextRequest) {
  if (!isAutorizado(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  waitUntil(
    executarSync().then((r) => console.log('[licitacoes] concluído:', JSON.stringify(r)))
  );

  return NextResponse.json({ status: 'iniciado' });
}
```

- [ ] **Commit**

```bash
git add app/api/cron/licitacoes/route.ts
git commit -m "feat(cron): busca licitacoes PNCP metalmecanico ES/MG"
```

---

### Task 3: API pública de leitura

**Files:**
- Create: `app/api/licitacoes/route.ts`

- [ ] **Criar `app/api/licitacoes/route.ts`**:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const revalidate = 300;

export async function GET(req: NextRequest) {
  const uf     = req.nextUrl.searchParams.get('uf');
  const status = req.nextUrl.searchParams.get('status');

  const supabase = await createClient();
  let query = supabase
    .from('licitacoes_pncp')
    .select('*')
    .order('data_encerramento', { ascending: true, nullsFirst: false })
    .limit(100);

  if (uf)     query = query.eq('uf', uf.toUpperCase());
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
}
```

- [ ] **Commit**

```bash
git add app/api/licitacoes/route.ts
git commit -m "feat(api): GET /api/licitacoes com filtros uf e status"
```

---

### Task 4: Página pública /licitacoes

**Files:**
- Create: `app/licitacoes/page.tsx`

- [ ] **Criar `app/licitacoes/page.tsx`**:

```tsx
import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import type { Database } from '@/types/database';

type Licitacao = Database['public']['Tables']['licitacoes_pncp']['Row'];

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Licitações',
  description:
    'Licitações públicas abertas para o setor metalmecânico nos estados do ES e MG. Dados do Portal Nacional de Contratações Públicas (PNCP).',
};

type Props = { searchParams: Promise<{ uf?: string; status?: string }> };

const STATUS_BADGE: Record<string, string> = {
  aberta:    'bg-green-100 text-green-700',
  encerrada: 'bg-gray-100 text-gray-500',
};

function formatarValor(v: number | null) {
  if (!v) return null;
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

function formatarData(d: string | null) {
  if (!d) return null;
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
}

function buildUrl(params: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); });
  const s = p.toString();
  return '/licitacoes' + (s ? '?' + s : '');
}

export default async function LicitacoesPage({ searchParams }: Props) {
  const { uf, status } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from('licitacoes_pncp')
    .select('*')
    .order('data_encerramento', { ascending: true, nullsFirst: false })
    .limit(100);

  if (uf)     query = query.eq('uf', uf.toUpperCase());
  if (status) query = query.eq('status', status);

  const { data: licitacoes } = await query;

  const ufAtual     = uf?.toUpperCase();
  const statusAtual = status;

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1 h-7 bg-[#C9A84C] rounded" />
          <h1 className="text-2xl font-black text-[#1A2B4A] uppercase tracking-wide">
            Licitações
          </h1>
        </div>
        <p className="text-gray-500 text-sm ml-4">
          Oportunidades de compras públicas para o setor metalmecânico em ES e MG.{' '}
          Fonte: PNCP — atualizadas diariamente.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { label: 'Todos os estados', u: undefined },
          { label: 'Espírito Santo',   u: 'ES' },
          { label: 'Minas Gerais',     u: 'MG' },
        ].map(({ label, u }) => (
          <Link
            key={label}
            href={buildUrl({ uf: u, status: statusAtual })}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              ufAtual === u || (!ufAtual && !u)
                ? 'bg-[#1A2B4A] text-white border-[#1A2B4A]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#1A2B4A]'
            }`}
          >
            {label}
          </Link>
        ))}

        <div className="w-px h-5 bg-gray-200 self-center mx-1" />

        {[
          { label: 'Todas',      s: undefined },
          { label: 'Abertas',    s: 'aberta' },
          { label: 'Encerradas', s: 'encerrada' },
        ].map(({ label, s }) => (
          <Link
            key={label}
            href={buildUrl({ uf: ufAtual, status: s })}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              statusAtual === s || (!statusAtual && !s)
                ? 'bg-[#1A2B4A] text-white border-[#1A2B4A]'
                : 'bg-white text-gray-600 border-gray-200 hover:border-[#1A2B4A]'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Lista */}
      {!licitacoes?.length ? (
        <p className="text-gray-400 text-sm">Nenhuma licitação encontrada com os filtros selecionados.</p>
      ) : (
        <div className="space-y-3">
          {licitacoes.map((l: Licitacao) => (
            <div
              key={l.id}
              className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold text-[#1A2B4A] text-sm leading-snug line-clamp-2">
                  {l.objeto ?? 'Objeto não informado'}
                </h2>
                <span
                  className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                    STATUS_BADGE[l.status] ?? STATUS_BADGE.encerrada
                  }`}
                >
                  {l.status === 'aberta' ? 'Aberta' : 'Encerrada'}
                </span>
              </div>

              <p className="text-xs text-gray-500 mt-2">
                {[l.orgao_nome, l.uf, l.modalidade].filter(Boolean).join(' · ')}
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-gray-400">
                {l.valor_estimado && (
                  <span>
                    <span className="font-medium text-gray-600">{formatarValor(l.valor_estimado)}</span>{' '}
                    estimado
                  </span>
                )}
                {l.data_encerramento && (
                  <span>
                    Encerra em{' '}
                    <span className="font-medium text-gray-600">{formatarData(l.data_encerramento)}</span>
                  </span>
                )}
                {l.link_pncp && (
                  <a
                    href={l.link_pncp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#1A2B4A] hover:text-[#C9A84C] font-medium transition-colors"
                  >
                    Ver no PNCP →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-gray-400">
        Fonte: Portal Nacional de Contratações Públicas (PNCP). Dados atualizados diariamente.
      </p>
    </main>
  );
}
```

- [ ] **Commit**

```bash
git add app/licitacoes/page.tsx
git commit -m "feat(ui): página /licitacoes com filtros UF e status"
```

---

### Task 5: Configurar cron no cron-job.org

O projeto usa cron-job.org (Vercel Hobby não suporta crons horários/diários).

- [ ] Acessar [cron-job.org](https://cron-job.org), criar novo job:
  - **URL:** `https://SEU_DOMINIO.vercel.app/api/cron/licitacoes?secret=VALOR_DO_CRON_SECRET`
  - **Horário:** 06:00 BRT (09:00 UTC)
  - **Frequência:** Diariamente

- [ ] Disparar o job manualmente uma vez e verificar que retorna `{"status":"iniciado"}`

---

### Task 6: Verificação end-to-end

- [ ] Disparar o cron e acompanhar logs no Vercel Functions (dashboard → projeto → Functions → licitacoes):

  Esperado nos logs:
  ```
  [licitacoes] filtradas=N upsertados=N erros=0
  [licitacoes] concluído: {"totalFiltradas":N,"upsertados":N,"erros":0}
  ```

- [ ] Acessar `/licitacoes` — cards devem aparecer com objeto, órgão, modalidade, valor e link PNCP

- [ ] Testar filtros:
  - `/licitacoes?uf=ES` — só ES
  - `/licitacoes?uf=MG` — só MG
  - `/licitacoes?status=aberta` — só abertas
  - `/licitacoes?uf=ES&status=encerrada` — combinado

- [ ] Confirmar que "Ver no PNCP →" abre a URL correta em nova aba

- [ ] Se a API PNCP retornar campos com nomes diferentes do esperado (o endpoint `/consulta` não foi validado localmente por timeout de rede), ajustar os nomes de campos em `PncpContratacao` no cron para bater com o JSON real recebido nos logs

---

## Notas

- O endpoint `/api/consulta/v1/contratacoes/publicacao` do PNCP tem latência alta a partir de redes locais (timeout observado). Em produção no Vercel (São Paulo), deve funcionar normalmente.
- Se os campos do JSON do PNCP diferirem dos mapeados em `PncpContratacao`, ajustar os nomes na Task 2 — os logs do cron mostrarão o JSON recebido se houver erro de parse.
- A filtragem por palavras-chave no `objeto` é uma aproximação para capítulos 72–85. Pode ser refinada futuramente com filtragem por CATMAT nos itens da licitação.
