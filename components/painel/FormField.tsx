export default function FormField({
  label,
  htmlFor,
  erro,
  children,
}: {
  label: string;
  htmlFor?: string;
  erro?: string;
  children: React.ReactNode;
}) {
  // Versão completa (variações de input, máscara, validação) na Fase 1.
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
      {erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
    </div>
  );
}
