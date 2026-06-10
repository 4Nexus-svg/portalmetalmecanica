"use client";

import { useState } from "react";
import { X, Link, Upload } from "lucide-react";
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
  const [arrastando, setArrastando] = useState(false);
  const [urlManual, setUrlManual] = useState("");

  async function uploadFile(file: File) {
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
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setArrastando(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setArrastando(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setArrastando(false);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    e.target.value = "";
  }

  function confirmarUrl() {
    let url = urlManual.trim();
    if (!url) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    onChange(url);
    setUrlManual("");
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
        <div className="space-y-2">
          {/* Zona de drag & drop */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`w-full rounded-lg border-2 border-dashed p-6 flex flex-col items-center justify-center gap-2 transition-colors select-none
              ${arrastando ? "border-[#C9A84C] bg-amber-50" : "border-gray-300 bg-gray-50 hover:border-gray-400"}`}
          >
            <Upload size={28} className={arrastando ? "text-[#C9A84C]" : "text-gray-300"} />
            <p className="text-sm font-semibold text-gray-600">
              {enviando ? "Enviando..." : arrastando ? "Solte o arquivo aqui!" : "Arraste o arquivo aqui"}
            </p>
            <p className="text-xs text-gray-400 text-center">
              Abra o Windows Explorer, encontre a imagem e arraste para cá
            </p>
            {/* input nativo como fallback silencioso */}
            <label className="mt-1 cursor-pointer">
              <span className="text-xs text-gray-400 underline hover:text-[#1A2B4A]">
                ou clique para selecionar (pode não funcionar em todos os navegadores)
              </span>
              <input
                type="file"
                accept={aceitaVideo ? "image/*,video/mp4,video/webm,video/ogg" : "image/*"}
                onChange={handleFile}
                disabled={enviando}
                className="hidden"
              />
            </label>
          </div>

          {/* URL como alternativa */}
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            <p className="text-xs text-gray-500 mb-2 font-medium flex items-center gap-1">
              <Link size={11} /> Ou cole a URL da imagem
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={urlManual}
                onChange={(e) => setUrlManual(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmarUrl()}
                placeholder="https://exemplo.com/imagem.jpg"
                className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
              />
              <button
                type="button"
                onClick={confirmarUrl}
                className="px-3 py-1.5 bg-[#1A2B4A] text-white text-sm rounded-lg hover:bg-[#0f1e35]"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
