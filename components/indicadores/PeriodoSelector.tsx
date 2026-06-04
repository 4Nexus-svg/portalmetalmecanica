'use client';

export type Periodo = '7d' | '30d' | '90d' | '1a';

type PeriodoSelectorProps = {
  value: Periodo;
  onChange: (p: Periodo) => void;
};

const OPCOES: { label: string; value: Periodo }[] = [
  { label: '7 dias', value: '7d' },
  { label: '30 dias', value: '30d' },
  { label: '90 dias', value: '90d' },
  { label: '1 ano', value: '1a' },
];

export function PeriodoSelector({ value, onChange }: PeriodoSelectorProps) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {OPCOES.map((op) => (
        <button
          key={op.value}
          onClick={() => onChange(op.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            value === op.value
              ? 'bg-white text-[#1A2B4A] shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {op.label}
        </button>
      ))}
    </div>
  );
}
