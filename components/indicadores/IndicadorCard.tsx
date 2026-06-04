import Link from 'next/link';
import { Sparkline } from './Sparkline';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type IndicadorCardProps = {
  slug: string;
  name: string;
  unit: string;
  decimals: number;
  frequency: string;
  value: number | null;
  variation: number | null;
  sparkline: number[];
  capturedAt: string | null;
};

function formatValue(value: number, unit: string, decimals: number): string {
  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (unit === 'R$') return `R$ ${formatted}`;
  if (unit === '% a.a.') return `${formatted}%`;
  if (unit === 'pts') return formatted;
  return `${formatted} ${unit}`;
}

export function IndicadorCard({
  slug,
  name,
  unit,
  decimals,
  frequency,
  value,
  variation,
  sparkline,
  capturedAt,
}: IndicadorCardProps) {
  const positive = (variation ?? 0) >= 0;
  const hasData = value !== null;

  return (
    <Link
      href={`/indicadores/${slug}`}
      className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-shadow group flex flex-col gap-2 min-h-[120px]"
    >
      {/* Nome + badge frequencia */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide leading-tight">
          {name}
        </span>
        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
          {frequency}
        </span>
      </div>

      {/* Valor + sparkline */}
      {hasData ? (
        <div className="flex items-end justify-between gap-2 flex-1">
          <div>
            <div className="text-xl font-black text-gray-900 group-hover:text-[#1A2B4A] transition-colors leading-tight">
              {formatValue(value!, unit, decimals)}
            </div>
            {variation !== null && (
              <div
                className={`text-sm font-semibold mt-0.5 ${
                  positive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {positive ? '▲' : '▼'} {Math.abs(variation).toFixed(2)}%
              </div>
            )}
          </div>
          <Sparkline data={sparkline} positive={positive} />
        </div>
      ) : (
        <div className="text-sm text-gray-400 italic py-2 flex-1">Aguardando dados...</div>
      )}

      {/* Ultima atualizacao */}
      {capturedAt && (
        <div className="text-[10px] text-gray-400 mt-auto">
          Atualizado{' '}
          {formatDistanceToNow(new Date(capturedAt), { addSuffix: true, locale: ptBR })}
        </div>
      )}
    </Link>
  );
}
