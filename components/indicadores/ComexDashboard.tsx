'use client';

import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const COR_ES = '#1A2B4A';
const COR_MG = '#C9A84C';
const COR_IMP = '#e74c3c';

type EvolucaoItem = { ano: number; mes: number; vl_fob: number };
type Capitulo = { capitulo: string; capitulo_desc: string | null; vl_fob: number };
type ComparativoAnual = Record<string, Record<number, number>>;

interface ComexData {
  uf: string;
  tipo: string;
  ultimoMes: { ano: number; mes: number } | null;
  evolucao: EvolucaoItem[];
  topCapitulos: Capitulo[];
  comparativoAnual: ComparativoAnual;
}

function formatFOB(v: number) {
  if (v >= 1e9) return `US$ ${(v / 1e9).toFixed(1)} bi`;
  if (v >= 1e6) return `US$ ${(v / 1e6).toFixed(0)} mi`;
  return `US$ ${v.toLocaleString('pt-BR')}`;
}

function buildEvolucaoData(evolucao: EvolucaoItem[]) {
  return evolucao.map(e => ({
    label: `${MESES[e.mes - 1]}/${String(e.ano).slice(2)}`,
    fob: e.vl_fob,
  }));
}

export function ComexDashboard() {
  const [uf, setUf] = useState<'ES' | 'MG'>('ES');
  const [tipo, setTipo] = useState<'EXP' | 'IMP'>('EXP');
  const [data, setData] = useState<ComexData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/indicadores/comex?uf=${uf}&tipo=${tipo}&anos=3`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [uf, tipo]);

  const evolucaoData = data ? buildEvolucaoData(data.evolucao) : [];

  // Comparativo anual ES vs MG
  const anosDisponiveis = data
    ? [...new Set([
        ...Object.keys(data.comparativoAnual.ES ?? {}).map(Number),
        ...Object.keys(data.comparativoAnual.MG ?? {}).map(Number),
      ])].sort()
    : [];
  const comparativoData = anosDisponiveis.map(ano => ({
    ano,
    ES: data?.comparativoAnual.ES?.[ano] ?? 0,
    MG: data?.comparativoAnual.MG?.[ano] ?? 0,
  }));

  return (
    <div className="space-y-6">
      {/* Controles */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm font-semibold">
          {(['EXP', 'IMP'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTipo(t)}
              className={`px-4 py-2 transition-colors ${tipo === t ? 'bg-[#1A2B4A] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {t === 'EXP' ? 'Exportações' : 'Importações'}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 text-sm font-semibold">
          {(['ES', 'MG'] as const).map(u => (
            <button
              key={u}
              onClick={() => setUf(u)}
              className={`px-4 py-2 transition-colors ${uf === u ? 'bg-[#C9A84C] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {u === 'ES' ? 'Espírito Santo' : 'Minas Gerais'}
            </button>
          ))}
        </div>
        {data?.ultimoMes && (
          <span className="text-xs text-gray-400 ml-auto">
            Dados até {MESES[data.ultimoMes.mes - 1]}/{data.ultimoMes.ano} · Fonte: MDIC Comexstat
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Carregando dados...</div>
      ) : !data ? (
        <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Dados indisponíveis</div>
      ) : (
        <>
          {/* Gráfico de evolução mensal */}
          <div className="bg-white rounded-xl border border-gray-100 p-4">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
              Evolução Mensal — {tipo === 'EXP' ? 'Exportações' : 'Importações'} {uf} (US$ FOB)
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={evolucaoData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis
                  tickFormatter={v => v >= 1e9 ? `${(v/1e9).toFixed(0)}bi` : `${(v/1e6).toFixed(0)}mi`}
                  tick={{ fontSize: 11 }} width={48}
                />
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                <Tooltip formatter={((v: unknown) => [formatFOB(Number(v ?? 0)), 'FOB']) as any} />
                <Line
                  type="monotone" dataKey="fob" stroke={tipo === 'EXP' ? COR_ES : COR_IMP}
                  strokeWidth={2} dot={false} activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top capítulos + Comparativo ES vs MG */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top 10 capítulos */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-3">
                Top Setores — {uf} {new Date().getFullYear()}
              </h3>
              <div className="space-y-2">
                {data.topCapitulos.slice(0, 8).map((c, i) => {
                  const max = data.topCapitulos[0]?.vl_fob ?? 1;
                  const pct = (c.vl_fob / max) * 100;
                  return (
                    <div key={c.capitulo} className="flex items-center gap-2 text-xs">
                      <span className="w-5 text-gray-400 font-mono">{String(i + 1).padStart(2, '0')}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="truncate text-gray-700 font-medium" title={c.capitulo_desc ?? c.capitulo}>
                            {c.capitulo_desc ? c.capitulo_desc.split(';')[0].trim() : `Cap. ${c.capitulo}`}
                          </span>
                          <span className="ml-2 text-gray-500 shrink-0">{formatFOB(c.vl_fob)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, backgroundColor: tipo === 'EXP' ? COR_ES : COR_IMP }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Comparativo ES vs MG */}
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-widest mb-4">
                Comparativo ES × MG — {tipo === 'EXP' ? 'Exportações' : 'Importações'} (US$ FOB Anual)
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={comparativoData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="ano" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={v => v >= 1e9 ? `${(v/1e9).toFixed(0)}bi` : `${(v/1e6).toFixed(0)}mi`}
                    tick={{ fontSize: 11 }} width={48}
                  />
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <Tooltip formatter={((v: unknown) => formatFOB(Number(v ?? 0))) as any} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ES" name="Espírito Santo" fill={COR_ES} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="MG" name="Minas Gerais" fill={COR_MG} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
