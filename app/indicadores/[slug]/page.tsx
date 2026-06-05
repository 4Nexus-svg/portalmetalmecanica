import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getIndicadorBySlug, getHistorico } from '@/lib/indicadores/queries';
import { HistoricoChart } from '@/components/indicadores/HistoricoChart';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await getIndicadorBySlug(slug);
  if (!result) return {};
  return {
    title: result.config.name,
    description: result.config.description ?? undefined,
  };
}

export default async function IndicadorDetalhe({ params }: Props) {
  const { slug } = await params;
  const result = await getIndicadorBySlug(slug);
  if (!result) notFound();

  const { config, latest } = result;

  // Indicadores mensais usam janelas maiores (3m, 6m, 1a, 2a)
  const isMonthly = config.frequency === 'mensal';
  const windows = isMonthly
    ? [90, 180, 365, 730]
    : [7, 30, 90, 365];

  const [h7, h30, h90, h365] = await Promise.all(
    windows.map(dias => getHistorico(slug, dias))
  );

  const historicoData = { '7d': h7, '30d': h30, '90d': h90, '1a': h365 };
  const periodoLabels = isMonthly
    ? { '7d': '3 meses', '30d': '6 meses', '90d': '1 ano', '1a': '2 anos' }
    : { '7d': '7 dias', '30d': '30 dias', '90d': '90 dias', '1a': '1 ano' };
  const positive = (latest?.variation ?? 0) >= 0;

  const valorFormatado = latest
    ? latest.value.toLocaleString('pt-BR', {
        minimumFractionDigits: config.decimals,
        maximumFractionDigits: config.decimals,
      })
    : null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-gray-400 mb-6">
        <Link href="/indicadores" className="hover:text-[#1A2B4A] transition-colors">
          Indicadores
        </Link>
        <span>/</span>
        <span className="text-gray-700">{config.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-6">

          {/* Header do indicador */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl font-black text-[#1A2B4A]">{config.name}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                    Atualização {config.frequency}
                  </span>
                  {config.source_url ? (
                    <a
                      href={config.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#C9A84C] hover:underline"
                    >
                      {config.source_label}
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">{config.source_label}</span>
                  )}
                </div>
              </div>

              {latest && (
                <div className="text-right flex-shrink-0">
                  <div className="text-3xl font-black text-gray-900 leading-tight">
                    {valorFormatado}{' '}
                    <span className="text-lg font-medium text-gray-400">{config.unit}</span>
                  </div>
                  {latest.variation !== null && (
                    <div
                      className={`text-base font-bold ${
                        positive ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {positive ? '▲' : '▼'} {Math.abs(latest.variation).toFixed(2)}%
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-1">
                    {format(
                      new Date(latest.captured_at),
                      "d 'de' MMMM 'de' yyyy 'às' HH:mm",
                      { locale: ptBR }
                    )}
                  </div>
                </div>
              )}
            </div>

            {!latest && (
              <div className="text-sm text-gray-400 italic mt-4">
                Aguardando primeira sincronização...
              </div>
            )}
          </div>

          {/* Grafico historico */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">
              Histórico
            </h2>
            <HistoricoChart
              data={historicoData}
              unit={config.unit}
              decimals={config.decimals}
              positive={positive}
              periodoLabels={periodoLabels}
            />
          </div>

          {/* Tabela historica */}
          {h30.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50">
                <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                  Dados Recentes
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                        Data
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                        Valor
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase">
                        Variação
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[...h30]
                      .reverse()
                      .slice(0, 20)
                      .map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-3 text-gray-600">
                            {format(new Date(s.captured_at), 'dd/MM/yyyy HH:mm', {
                              locale: ptBR,
                            })}
                          </td>
                          <td className="px-6 py-3 text-right font-semibold text-gray-900">
                            {s.value.toLocaleString('pt-BR', {
                              minimumFractionDigits: config.decimals,
                              maximumFractionDigits: config.decimals,
                            })}{' '}
                            {config.unit}
                          </td>
                          <td className="px-6 py-3 text-right">
                            {s.variation !== null ? (
                              <span
                                className={
                                  s.variation >= 0 ? 'text-green-600' : 'text-red-600'
                                }
                              >
                                {s.variation >= 0 ? '▲' : '▼'}{' '}
                                {Math.abs(s.variation).toFixed(2)}%
                              </span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {config.description && (
            <div className="bg-[#1A2B4A] rounded-xl p-5 text-white">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 bg-[#C9A84C] rounded" />
                <h3 className="text-sm font-bold uppercase tracking-wide">Por que acompanhar?</h3>
              </div>
              <p className="text-blue-100 text-sm leading-relaxed">{config.description}</p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
              Informações
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Unidade</dt>
                <dd className="font-medium text-gray-900">{config.unit}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Atualização</dt>
                <dd className="font-medium text-gray-900 capitalize">{config.frequency}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Fonte</dt>
                <dd className="font-medium text-gray-900">{config.source_label}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Registros (1 ano)</dt>
                <dd className="font-medium text-gray-900">{h365.length}</dd>
              </div>
            </dl>
          </div>

          <Link
            href="/indicadores"
            className="flex items-center gap-2 text-sm text-[#1A2B4A] font-medium hover:underline"
          >
            ← Todos os indicadores
          </Link>
        </aside>
      </div>
    </div>
  );
}
