"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DataTable from "@/components/painel/DataTable";
import Modal from "@/components/painel/Modal";
import { FormField, Input, Textarea } from "@/components/painel/FormField";
import ImageUpload from "@/components/painel/ImageUpload";
import Badge from "@/components/painel/Badge";
import { criarDestaque, atualizarDestaque, excluirDestaque, type DestaqueInput } from "./actions";
import type { Database } from "@/types/database";

type Destaque = Database["public"]["Tables"]["featured_companies"]["Row"];

function vazio(): DestaqueInput {
  return { name: "", logo_url: null, link: null, description: null, ordem: 0, ativo: true, start_date: null, end_date: null };
}

export default function DestaquesClient({ itens }: { itens: Destaque[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<DestaqueInput>(vazio());
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() { setEditId(null); setForm(vazio()); setAberto(true); }
  function abrirEdicao(d: Destaque) {
    setEditId(d.id);
    setForm({ name: d.name, logo_url: d.logo_url, link: d.link, description: d.description, ordem: d.ordem, ativo: d.ativo, start_date: d.start_date, end_date: d.end_date });
    setAberto(true);
  }

  async function salvar() {
    if (!form.name) { toast.error("Nome obrigatório"); return; }
    setSalvando(true);
    try {
      if (editId) await atualizarDestaque(editId, form);
      else await criarDestaque(form);
      toast.success("Empresa salva");
      setAberto(false);
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSalvando(false); }
  }

  async function remover(id: number) {
    if (!confirm("Excluir esta empresa?")) return;
    try { await excluirDestaque(id); toast.success("Excluída"); router.refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={abrirNovo} className="bg-[#1A2B4A] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] text-sm">
          + Nova empresa
        </button>
      </div>

      <DataTable<Destaque>
        dados={itens}
        vazio="Nenhuma empresa em destaque."
        colunas={[
          { chave: "logo_url", titulo: "Logo", render: (d) => d.logo_url ? <img src={d.logo_url} alt="" className="h-10 rounded object-contain" /> : "—" },
          { chave: "name", titulo: "Nome" },
          { chave: "ordem", titulo: "Ordem" },
          { chave: "vigencia", titulo: "Vigência", render: (d) => `${d.start_date ?? "—"} → ${d.end_date ?? "—"}` },
          { chave: "ativo", titulo: "Ativo", render: (d) => <Badge variant={d.ativo ? "sucesso" : "neutro"}>{d.ativo ? "Sim" : "Não"}</Badge> },
        ]}
        acoes={(d) => (
          <div className="flex gap-3 justify-end">
            <button onClick={() => abrirEdicao(d)} className="text-blue-700 hover:text-blue-900 text-xs font-medium">Editar</button>
            <button onClick={() => remover(d.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Excluir</button>
          </div>
        )}
      />

      <Modal aberto={aberto} titulo={editId ? "Editar empresa" : "Nova empresa"} onFechar={() => setAberto(false)}>
        <ImageUpload label="Logo" valor={form.logo_url} onChange={(url) => setForm((f) => ({ ...f, logo_url: url }))} />
        <FormField label="Nome">
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </FormField>
        <FormField label="Link">
          <Input value={form.link ?? ""} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value || null }))} placeholder="https://..." />
        </FormField>
        <FormField label="Descrição curta">
          <Textarea rows={2} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Ordem">
            <Input type="number" value={form.ordem} onChange={(e) => setForm((f) => ({ ...f, ordem: parseInt(e.target.value) || 0 }))} />
          </FormField>
          <FormField label="Ativo">
            <label className="flex items-center gap-2 mt-2 text-sm">
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} />
              Exibir no site
            </label>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Início">
            <Input type="date" value={form.start_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value || null }))} />
          </FormField>
          <FormField label="Fim">
            <Input type="date" value={form.end_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value || null }))} />
          </FormField>
        </div>
        <button onClick={salvar} disabled={salvando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </Modal>
    </>
  );
}
