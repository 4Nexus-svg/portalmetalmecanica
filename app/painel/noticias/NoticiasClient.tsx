"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DataTable from "@/components/painel/DataTable";
import Modal from "@/components/painel/Modal";
import { FormField, Input, Textarea } from "@/components/painel/FormField";
import Badge from "@/components/painel/Badge";
import { criarPost, atualizarPost, excluirPost, type PostInput } from "./actions";
import type { Database } from "@/types/database";

type Post = Database["public"]["Tables"]["posts"]["Row"];

function vazio(): PostInput {
  return {
    title: "",
    slug: "",
    excerpt: null,
    content: null,
    featured_image: null,
    category: null,
    region: "ES",
    published_at: new Date().toISOString().slice(0, 16),
    is_exclusive: false,
  };
}

function gerarSlug(titulo: string) {
  return titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export default function NoticiasClient({ itens }: { itens: Post[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<PostInput>(vazio());
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() {
    setEditId(null);
    setForm(vazio());
    setAberto(true);
  }

  function abrirEdicao(p: Post) {
    setEditId(p.id);
    setForm({
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt,
      content: p.content,
      featured_image: p.featured_image,
      category: p.category,
      region: p.region,
      published_at: p.published_at ? p.published_at.slice(0, 16) : null,
      is_exclusive: p.is_exclusive,
    });
    setAberto(true);
  }

  function handleTitulo(titulo: string) {
    setForm((f) => ({
      ...f,
      title: titulo,
      slug: editId ? f.slug : gerarSlug(titulo),
    }));
  }

  async function salvar() {
    if (!form.title || !form.slug) {
      toast.error("Título e slug são obrigatórios");
      return;
    }
    setSalvando(true);
    try {
      const payload: PostInput = {
        ...form,
        published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
      };
      if (editId) await atualizarPost(editId, payload);
      else await criarPost(payload);
      toast.success(editId ? "Notícia atualizada" : "Notícia criada");
      setAberto(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: number) {
    if (!confirm("Excluir esta notícia?")) return;
    try {
      await excluirPost(id);
      toast.success("Notícia excluída");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          onClick={abrirNovo}
          className="bg-[#1A2B4A] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] text-sm"
        >
          + Nova notícia
        </button>
      </div>

      <DataTable<Post>
        dados={itens}
        vazio="Nenhuma notícia encontrada."
        colunas={[
          { chave: "title", titulo: "Título" },
          { chave: "category", titulo: "Categoria", render: (p) => p.category ?? "—" },
          { chave: "region", titulo: "Região", render: (p) => p.region ?? "—" },
          {
            chave: "published_at",
            titulo: "Publicado em",
            render: (p) =>
              p.published_at
                ? new Date(p.published_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                : "—",
          },
          {
            chave: "is_auto",
            titulo: "Origem",
            render: (p) =>
              p.is_auto ? (
                <Badge variant="info">Auto</Badge>
              ) : (
                <Badge variant="sucesso">Manual</Badge>
              ),
          },
          {
            chave: "is_exclusive",
            titulo: "Exclusivo",
            render: (p) =>
              p.is_exclusive ? <Badge variant="alerta">Assinante</Badge> : null,
          },
        ]}
        acoes={(p) => (
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => abrirEdicao(p)}
              className="text-blue-700 hover:text-blue-900 text-xs font-medium"
            >
              Editar
            </button>
            <button
              onClick={() => remover(p.id)}
              className="text-red-600 hover:text-red-800 text-xs font-medium"
            >
              Excluir
            </button>
          </div>
        )}
      />

      {aberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="font-semibold text-[#1A2B4A]">
                {editId ? "Editar notícia" : "Nova notícia"}
              </h2>
              <button
                onClick={() => setAberto(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <FormField label="Título *">
                <Input
                  value={form.title}
                  onChange={(e) => handleTitulo(e.target.value)}
                  placeholder="Ex: Setor metalmecânico cresce 15% no ES"
                />
              </FormField>

              <FormField label="Slug *">
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">URL: /noticias/{form.slug}</p>
              </FormField>

              <FormField label="Resumo">
                <Textarea
                  rows={2}
                  value={form.excerpt ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value || null }))}
                  placeholder="Breve descrição que aparece na listagem..."
                />
              </FormField>

              <FormField label="Conteúdo (HTML)">
                <Textarea
                  rows={10}
                  value={form.content ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value || null }))}
                  placeholder="<p>Conteúdo da notícia...</p>"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Categoria">
                  <Input
                    value={form.category ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value || null }))}
                    placeholder="Ex: Mercado, Tecnologia, ESG..."
                  />
                </FormField>
                <FormField label="Região">
                  <select
                    value={form.region ?? "ES"}
                    onChange={(e) => setForm((f) => ({ ...f, region: e.target.value || null }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900"
                  >
                    <option value="ES">ES</option>
                    <option value="MG">MG</option>
                    <option value="Brasil">Brasil</option>
                    <option value="Internacional">Internacional</option>
                  </select>
                </FormField>
              </div>

              <FormField label="Imagem destacada (URL)">
                <Input
                  value={form.featured_image ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, featured_image: e.target.value || null }))}
                  placeholder="https://..."
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Data de publicação">
                  <Input
                    type="datetime-local"
                    value={form.published_at ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, published_at: e.target.value || null }))}
                  />
                </FormField>
                <FormField label="Exclusivo para assinantes">
                  <label className="flex items-center gap-2 mt-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_exclusive}
                      onChange={(e) => setForm((f) => ({ ...f, is_exclusive: e.target.checked }))}
                      className="w-4 h-4 accent-blue-900"
                    />
                    Apenas assinantes
                  </label>
                </FormField>
              </div>

              <button
                onClick={salvar}
                disabled={salvando}
                className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50"
              >
                {salvando ? "Salvando..." : "Salvar notícia"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
