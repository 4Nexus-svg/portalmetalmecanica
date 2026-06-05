'use client';

export type Periodo = '7d' | '30d' | '90d' | '1a';

const DEFAULT_LABELS: Record<Periodo, string> = {
  '7d': '7 dias',
  '30d': '30 dias',
  '90d': '90 dias',
  '1a': '1 ano',
};

type PeriodoSelectorProps = {
  value: Periodo;
  onChange: (p: Periodo) => void;
  labels?: Record<Periodo, string>;
};

const PERIODOS: Periodo[] = ['7d', '30d', '90d', '1a'];

export function PeriodoSelector({ value, onChange, labels = DEFAULT_LABELS }: PeriodoSelectorProps) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {PERIODOS.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            value === p
              ? 'bg-white text-[#1A2B4A] shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {labels[p]}
        </button>
      ))}
    </div>
  );
}
