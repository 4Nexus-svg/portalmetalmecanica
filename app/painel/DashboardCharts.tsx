"use client";

import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export interface SeriePonto { label: string; valor: number; }

export default function DashboardCharts({
  assinantesPorMes,
  postsPorCategoria,
}: {
  assinantesPorMes: SeriePonto[];
  postsPorCategoria: SeriePonto[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Novos assinantes por mês</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={assinantesPorMes}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" fontSize={12} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip />
            <Area type="monotone" dataKey="valor" stroke="#1A2B4A" fill="#C9A84C" fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Notícias por categoria</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={postsPorCategoria}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="label" fontSize={12} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip />
            <Bar dataKey="valor" fill="#1A2B4A" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
