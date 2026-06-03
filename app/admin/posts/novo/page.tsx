"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NovoPostPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    category: "",
    region: "ES",
    is_exclusive: false,
    published_at: new Date().toISOString().slice(0, 16),
  });

  function handleTitle(title: string) {
    const slug = title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    setForm((f) => ({ ...f, title, slug }));
  }

  async function handleSubmit() {
    if (!form.title || !form.slug) {
      toast.error("Título e slug são obrigatórios");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await (supabase.from("posts") as any).insert({
      title: form.title,
      slug: form.slug,
      excerpt: form.excerpt || null,
      content: form.content || null,
      category: form.category || null,
      region: form.region || null,
      is_exclusive: form.is_exclusive,
      published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
      author_id: user?.id ?? null,
    });

    setLoading(false);

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }

    toast.success("Post criado com sucesso!");
    router.push("/admin");
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-blue-900 mb-8">
        <ArrowLeft size={16} /> Voltar ao painel
      </Link>

      <h1 className="text-2xl font-bold text-gray-900 mb-8">Nova notícia</h1>

      <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-5">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Título *</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => handleTitle(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
            placeholder="Ex: Setor metalmecânico cresce 15% no ES"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 font-mono"
          />
          <p className="text-xs text-gray-400 mt-1">URL: /noticias/{form.slug}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Resumo (excerpt)</label>
          <textarea
            value={form.excerpt}
            onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
            placeholder="Breve descrição que aparece na listagem..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Conteúdo (HTML)</label>
          <textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            rows={10}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900 font-mono"
            placeholder="<p>Conteúdo da notícia...</p>"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
            >
              <option value="">Selecione...</option>
              <option>Mercado</option>
              <option>Tecnologia</option>
              <option>Industria</option>
              <option>Emprego</option>
              <option>Legislacao</option>
              <option>Eventos</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Região</label>
            <select
              value={form.region}
              onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
            >
              <option value="ES">ES</option>
              <option value="MG">MG</option>
              <option value="Brasil">Brasil</option>
              <option value="Internacional">Internacional</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Data de publicação</label>
          <input
            type="datetime-local"
            value={form.published_at}
            onChange={(e) => setForm((f) => ({ ...f, published_at: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="exclusive"
            checked={form.is_exclusive}
            onChange={(e) => setForm((f) => ({ ...f, is_exclusive: e.target.checked }))}
            className="w-4 h-4 accent-blue-900"
          />
          <label htmlFor="exclusive" className="text-sm font-medium text-gray-700">
            Conteúdo exclusivo para assinantes
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-orange-500 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            {loading ? "Salvando..." : "Publicar notícia"}
          </button>
          <Link href="/admin" className="border border-gray-200 text-gray-600 font-medium px-6 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
            Cancelar
          </Link>
        </div>
      </div>
    </main>
  );
}