"use client";

export default function ImageUpload({
  valor,
  onChange,
  label = "Imagem",
}: {
  valor?: string | null;
  onChange?: (url: string | null) => void;
  label?: string;
}) {
  // Versão completa (upload para Supabase Storage, bucket `painel`) na Fase 1.
  // `onChange` reservado para a integração de upload da Fase 1.
  void onChange;
  return (
    <div className="mb-4">
      <p className="block text-sm font-medium text-gray-700 mb-1">{label}</p>
      <div className="flex items-center justify-center h-32 rounded-lg border-2 border-dashed border-gray-200 text-sm text-gray-400">
        {valor ? "Imagem definida" : "Upload disponível na Fase 1"}
      </div>
    </div>
  );
}
