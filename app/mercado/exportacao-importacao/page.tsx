import type { Metadata } from 'next';
import { ComexDashboard } from '@/components/indicadores/ComexDashboard';

export const metadata: Metadata = {
  title: 'Exportação & Importação',
  description:
    'Acompanhe os dados de exportação e importação do Espírito Santo e Minas Gerais. Evolução mensal em US$ FOB, top setores industriais e comparativo entre os estados. Dados MDIC Comexstat.',
};

export default function ExportacaoImportacaoPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-1 h-7 bg-[#C9A84C] rounded" />
          <h1 className="text-2xl font-black text-[#1A2B4A] uppercase tracking-wide">
            Exportação & Importação
          </h1>
        </div>
        <p className="text-gray-500 text-sm ml-4">
          Dados de comércio exterior do Espírito Santo e Minas Gerais por setor industrial.
          Fonte: MDIC Comexstat — Dados Abertos (NCM).
        </p>
      </div>

      <ComexDashboard />
    </div>
  );
}
