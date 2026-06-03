"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import Link from "next/link";
import { ArrowLeft, X, Upload } from "lucide-react";
import { CIDADES_POR_ESTADO, ESTADOS } from "@/lib/cidades";

export default function NovoClassificadoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fotos, setFotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "",
    state: "ES",
    city: "",
    phone: "",
    whatsapp: "",
  });

  const cidadesDoEstado = CIDADES_POR_ESTADO[form.state] ?? [];

  function handleEstado(e: React.ChangeEvent<HTMLSelectElement>) {
    setForm((f) => ({ ...f, state: e.target.value, city: "" }));
  }

  function handleFotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fotos.length + files.length > 5) {
      toast.error("Máximo de 5 fotos");
      return;
    }
    const novasFotos = [...fotos, ...files];
    setFotos(novasFotos);
    setPreviews(novasFotos.map((f) => URL.createObjectURL(f)));
  }

  function removerFoto(index: number) {
    const novasFotos = fotos.filter((_, i) => i !== index);
    setFotos(novasFotos);
    setPreviews(novasFotos.map((f) => URL.createObjectURL(f)));
  }

  async function uploadFotos(userId: string): Promise<string[]> {
    const supabase = createClient();
    const urls: string[] = [];

    for (const foto of fotos) {
      const ext = foto.name.split(".").pop();
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from("classifieds")
        .upload(path, foto, { contentType: foto.type });

      if (error) {
        toast.error("Erro ao enviar foto: " + error.message);
        continue;
      }

      const { data } = supabase.storage.from("classifieds").getPublicUrl(path);
      urls.push(data.publicUrl);
    }

    return urls;
  }

  async function handleSubmit(destaque: boolean) {
    if (!form.title) { toast.error("Título obrigatório"); return; }
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      toast.error("Faça login primeiro");
      router.push("/login?next=/classificados/novo");
      return;
    }

    const photoUrls = fotos.length > 0 ? await uploadFotos(user.id) : [];

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (destaque ? 30 : 15));

    const { data, error } = await (supabase.from("classifieds") as any).insert({
      user_id: user.id,
      title: form.title,
      description: form.description || null,
      price: form.price ? parseFloat(form.price) : null,
      category: form.category || null,
      city: form.city || null,
      state: form.state || null,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      photos: photoUrls.length > 0 ? photoUrls : null,
      status: destaque ? "pending" : "active",
      expires_at: expiresAt.toISOString(),
    }).select().single();

    setLoading(false);

    if (error) { toast.error("Erro: " + error.message); return; }

    if (destaque && data) {
      router.push("/classificados/pagamento/" + data.id);
      return;
    }

    toast.success("Anúncio publicado! Válido por 15 dias.");
    router.push("/classificados");
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-10">
      <Link href="/classificados" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-900 mb-8">
        <ArrowLeft size={16} /> Voltar aos classificados
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Publicar anúncio</h1>
      <p className="text-sm text-gray-500 mb-8">Anúncio grátis por 15 dias ou destaque por R$ 150 (30 dias)</p>

      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">

        {/* Upload de fotos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fotos <span className="text-gray-400 font-normal">(até 5 fotos)</span>
          </label>

          {previews.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
              {previews.map((src, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removerFoto(i)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {fotos.length < 5 && (
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-blue-900 hover:bg-blue-50 transition-colors">
              <Upload size={20} className="text-gray-400 mb-2" />
              <span className="text-sm text-gray-500">Clique para adicionar fotos</span>
              <span className="text-xs text-gray-400 mt-1">JPG, PNG até 5MB cada</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={handleFotos} />
            </label>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
            placeholder="Ex: Torno mecânico CNC seminovo"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={4}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
            placeholder="Descreva o que está anunciando..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$)</label>
            <input
              type="number"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
              placeholder="0,00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
            >
              <option value="">Selecione...</option>
              <option>Máquinas</option>
              <option>Equipamentos</option>
              <option>Peças</option>
              <option>Serviços</option>
              <option>Veículos</option>
              <option>Outros</option>
            </select>
          </div>
        </div>

        {/* Localização */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
            <select
              value={form.state}
              onChange={handleEstado}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
            >
              {ESTADOS.map((uf) => (
                <option key={uf} value={uf}>{uf}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
            <select
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
            >
              <option value="">Selecione...</option>
              {cidadesDoEstado.map((cidade) => (
                <option key={cidade} value={cidade}>{cidade}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Contato */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">Contato <span className="text-gray-400 font-normal">(opcional)</span></p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Telefone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                placeholder="(27) 99999-9999"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">WhatsApp</label>
              <input
                type="tel"
                value={form.whatsapp}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                placeholder="(27) 99999-9999"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={() => handleSubmit(false)}
            disabled={loading}
            className="border-2 border-blue-900 text-blue-900 font-semibold py-3 rounded-lg hover:bg-blue-900 hover:text-white transition-colors disabled:opacity-50"
          >
            {loading ? "Publicando..." : "Publicar grátis"}
            <span className="block text-xs font-normal opacity-70">15 dias</span>
          </button>
          <button
            onClick={() => handleSubmit(true)}
            disabled={loading}
            className="bg-orange-500 text-white font-semibold py-3 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {loading ? "Publicando..." : "Publicar com destaque"}
            <span className="block text-xs font-normal opacity-80">R$ 150 — 30 dias</span>
          </button>
        </div>

      </div>
    </main>
  );
}
