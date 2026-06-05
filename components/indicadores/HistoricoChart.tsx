'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PeriodoSelector } from './PeriodoSelector';
import type { Periodo } from './PeriodoSelector';

type Snapshot = {
  value: number;
  captured_at: string;
};

type HistoricoChartProps = {
  data: Record<Periodo, Snapshot[]>;
  unit: string;
  decimals: number;
  positive: boolean;
  periodoLabels?: Record<Periodo, string>;
};


export function HistoricoChart({ data, unit, decimals, positive, periodoLabels }: HistoricoChartProps) {
  const [periodo, setPeriodo] = useState<Periodo>('30d');
  const snapshots = data[periodo];

  const chartData = snapshots.map((s) => ({
    date: format(new Date(s.captured_at), 'dd/MM', { locale: ptBR }),
    value: s.value,
  }));

  const color = positive ? '#16a34a' : '#1A2B4A';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500">
          {snapshots.length} {snapshots.length === 1 ? 'registro' : 'registros'}
        </span>
        <PeriodoSelector value={periodo} onChange={setPeriodo} labels={periodoLabels} />
      </div>

      {snapshots.length < 2 ? (
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-400">
          Dados insuficientes para o período selecionado
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) =>
                  v.toLocaleString('pt-BR', {
                    minimumFractionDigits: decimals,
                    maximumFractionDigits: decimals,
                  })
                }
                width={65}
              />
              <Tooltip
                formatter={(v: unknown) => [
                  typeof v === 'number'
                    ? `${v.toLocaleString('pt-BR', {
                        minimumFractionDigits: decimals,
                        maximumFractionDigits: decimals,
                      })} ${unit}`
                    : String(v),
                  'Valor',
                ]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: color }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
