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

async function fetchPagina(
  uf: string,
  dataInicial: string,
  dataFinal: string,
  pagina: number,
): Promise<PncpPage> {
  const params = new URLSearchParams({
    uf,
    dataInicial,
    dataFinal,
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
    executarSync().then((r) => console.log('[licitacoes] concluído:', JSON.stringify(r))),
  );

  return NextResponse.json({ status: 'iniciado' });
}
