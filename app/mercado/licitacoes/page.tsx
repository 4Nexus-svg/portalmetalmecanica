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
  return '/mercado/licitacoes' + (s ? '?' + s : '');
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
          Oportunidades de compras públicas para o setor metalmecânico em ES e MG.
        </p>
      </div>

      {/* Links diretos PNCP */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-8">
        <p className="text-sm font-semibold text-[#1A2B4A] mb-1">Buscar diretamente no PNCP</p>
        <p className="text-xs text-gray-500 mb-4">
          O Portal Nacional de Contratações Públicas (PNCP) é a fonte oficial de licitações federais.
          Pesquise em tempo real filtrando por estado e palavras-chave do setor.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://pncp.gov.br/app/editais?ufs=ES&status=recebendo_proposta"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#1A2B4A] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] transition-colors"
          >
            Licitações no ES →
          </a>
          <a
            href="https://pncp.gov.br/app/editais?ufs=MG&status=recebendo_proposta"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#1A2B4A] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] transition-colors"
          >
            Licitações em MG →
          </a>
          <a
            href="https://pncp.gov.br/app/editais?status=recebendo_proposta"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-[#1A2B4A] text-[#1A2B4A] text-sm font-semibold px-4 py-2 rounded-lg hover:bg-[#1A2B4A]/5 transition-colors"
          >
            Busca avançada no PNCP
          </a>
        </div>
      </div>

      {/* Separador curadoria */}
      {licitacoes && licitacoes.length > 0 && (
        <div className="flex items-center gap-3 mb-5">
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">
            Selecionadas pela redação
          </h2>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
      )}

      {/* Filtros — só exibe se há itens */}
      <div className={`flex flex-wrap gap-2 mb-6 ${!licitacoes?.length ? 'hidden' : ''}`}>
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
        <p className="text-gray-400 text-sm">
          Nenhuma licitação encontrada com os filtros selecionados.
        </p>
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
        Fonte: Portal Nacional de Contratações Públicas (PNCP). Licitações selecionadas pela equipe editorial.
      </p>
    </main>
  );
}
