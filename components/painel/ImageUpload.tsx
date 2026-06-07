"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
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
    if (error) { toast.error("Erro ao enviar imagem: " + error.message); return; }
    const { data } = supabase.storage.from("painel").getPublicUrl(path);
    onChange(data.publicUrl);
  }

  return (
    <div className="mb-4">
      <p className="block text-sm font-medium text-gray-700 mb-1">{label}</p>
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
        <label className="flex flex-col items-center justify-center w-full h-32 rounded-lg border-2 border-dashed border-gray-200 cursor-pointer hover:border-[#C9A84C] hover:bg-amber-50 transition-colors">
          <Upload size={20} className="text-gray-400 mb-2" />
          <span className="text-sm text-gray-500">{enviando ? "Enviando..." : "Clique para enviar"}</span>
          <span className="text-xs text-gray-400 mt-0.5">{aceitaVideo ? "Imagem ou vídeo (MP4, WebM)" : "JPG, PNG, GIF, WebP"}</span>
          <input type="file" accept={aceitaVideo ? "image/*,video/mp4,video/webm,video/ogg" : "image/*"} className="hidden" onChange={handleFile} disabled={enviando} />
        </label>
      )}
    </div>
  );
}
