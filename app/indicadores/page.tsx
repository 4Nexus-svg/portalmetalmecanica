import type { Metadata } from 'next';
import { getIndicadoresComDados } from '@/lib/indicadores/queries';
import { IndicadorCard } from '@/components/indicadores/IndicadorCard';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Indicadores Econômicos',
  description:
    'Acompanhe os principais indicadores econômicos e de commodities para o setor metalmecânico: Dólar, Ibovespa, Selic, aço, cobre, alumínio e muito mais.',
};

const GRUPOS_ORDER = ['Financeiros', 'Commodities Industriais', 'Regional ES & MG'];

export default async function IndicadoresPage() {
  const indicadores = await getIndicadoresComDados();

  const grupos = GRUPOS_ORDER.map((grupo) => ({
    nome: grupo,
    items: indicadores.filter((i) => i.group_name === grupo),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1 h-7 bg-[#C9A84C] rounded" />
          <h1 className="text-2xl font-black text-[#1A2B4A] uppercase tracking-wide">
            Indicadores
          </h1>
        </div>
        <p className="text-gray-500 text-sm ml-4">
          Dados econômicos e de commodities relevantes para o setor metalmecânico do ES e MG.
          Valores atualizados automaticamente via fontes públicas.
        </p>
      </div>

      {/* Grupos */}
      <div className="space-y-10">
        {grupos.map((grupo) => (
          <section key={grupo.nome}>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                {grupo.nome}
              </h2>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {grupo.items.map((ind) => (
                <IndicadorCard
                  key={ind.slug}
                  slug={ind.slug}
                  name={ind.name}
                  unit={ind.unit}
                  decimals={ind.decimals}
                  frequency={ind.frequency}
                  value={ind.latest?.value ?? null}
                  variation={ind.latest?.variation ?? null}
                  sparkline={ind.sparkline}
                  capturedAt={ind.latest?.captured_at ?? null}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Rodape informativo */}
      <div className="mt-12 p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-400">
        <strong className="text-gray-500">Fontes:</strong> Open Exchange Rates (câmbio), brapi.dev
        (Ibovespa), Yahoo Finance (commodities), Banco Central do Brasil (Selic), MDIC Comex Stat
        (exportações), IBGE SIDRA (produção industrial). Dados com fins informativos — não
        constituem recomendação de investimento.
      </div>
    </div>
  );
}
