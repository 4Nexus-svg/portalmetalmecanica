import type { LucideIcon } from "lucide-react";

export default function EmptyState({
  icon: Icon,
  titulo,
  descricao,
  acao,
}: {
  icon?: LucideIcon;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16">
      {Icon && <Icon className="w-10 h-10 text-gray-300 mb-4" />}
      <p className="text-gray-700 font-medium">{titulo}</p>
      {descricao && <p className="text-sm text-gray-400 mt-1 max-w-sm">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}
