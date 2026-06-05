export interface Coluna<T> {
  chave: keyof T | string;
  titulo: string;
  render?: (linha: T) => React.ReactNode;
}

export default function DataTable<T extends { id: string | number }>({
  colunas,
  dados,
  acoes,
  vazio = "Nenhum registro.",
}: {
  colunas: Coluna<T>[];
  dados: T[];
  acoes?: (linha: T) => React.ReactNode;
  vazio?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
          <tr>
            {colunas.map((c) => (
              <th key={String(c.chave)} className="text-left px-6 py-3">{c.titulo}</th>
            ))}
            {acoes && <th className="px-6 py-3 text-right">Ações</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {dados.map((linha) => (
            <tr key={linha.id} className="hover:bg-gray-50 transition-colors">
              {colunas.map((c) => (
                <td key={String(c.chave)} className="px-6 py-4 text-gray-700">
                  {c.render ? c.render(linha) : String((linha as Record<string, unknown>)[String(c.chave)] ?? "—")}
                </td>
              ))}
              {acoes && <td className="px-6 py-4 text-right whitespace-nowrap">{acoes(linha)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {dados.length === 0 && (
        <div className="px-6 py-12 text-center text-gray-400">{vazio}</div>
      )}
    </div>
  );
}
