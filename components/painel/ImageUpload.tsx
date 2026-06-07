"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";

export default function ImageUpload({
  valor,
  onChange,
  label = "Imagem",
  aceitaVideo = false,
}: {
  valor?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  aceitaVideo?: boolean;
}) {
  const [enviando, setEnviando] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEnviando(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const ext = file.name.split(".").pop();
    const path = `${user?.id ?? "anon"}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("painel").upload(path, file, { contentType: file.type });
    setEnviando(false);
    if (error) { toast.error("Erro ao enviar: " + error.message); return; }
    const { data } = supabase.storage.from("painel").getPublicUrl(path);
    onChange(data.publicUrl);
    e.target.value = "";
  }

  return (
    <div className="mb-4">
      <p className="block text-sm font-medium text-gray-700 mb-2">{label}</p>

      {valor ? (
        <div className="relative inline-block">
          {/\.(mp4|webm|ogg)(\?.*)?$/i.test(valor) ? (
            <video src={valor} className="h-32 rounded-lg border border-gray-200 bg-gray-50" muted playsInline />
          ) : (
            <img src={valor} alt="" className="h-32 rounded-lg border border-gray-200 object-contain bg-gray-50" />
          )}
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-4 bg-gray-50">
          <input
            type="file"
            accept={aceitaVideo ? "image/*,video/mp4,video/webm,video/ogg" : "image/*"}
            onChange={handleFile}
            disabled={enviando}
            className="block w-full text-sm text-gray-600
              file:mr-3 file:py-2 file:px-4
              file:rounded-lg file:border-0
              file:text-sm file:font-medium
              file:bg-[#1A2B4A] file:text-white
              file:cursor-pointer
              hover:file:bg-[#0f1e35]
              disabled:opacity-60"
          />
          <p className="mt-2 text-xs text-gray-400">
            {aceitaVideo ? "Imagem ou vídeo (MP4, WebM, OGG)" : "JPG, PNG, GIF, WebP"}
          </p>
          {enviando && <p className="mt-1 text-xs text-amber-600 font-medium">Enviando...</p>}
        </div>
      )}
    </div>
  );
}
