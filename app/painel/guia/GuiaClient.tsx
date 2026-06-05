"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DataTable from "@/components/painel/DataTable";
import Modal from "@/components/painel/Modal";
import { FormField, Input, Textarea } from "@/components/painel/FormField";
import ImageUpload from "@/components/painel/ImageUpload";
import Badge from "@/components/painel/Badge";
import { criarEmpresa, atualizarEmpresa, excluirEmpresa, type CompanyInput } from "./actions";
import type { Database } from "@/types/database";

type Empresa = Database["public"]["Tables"]["companies"]["Row"];

function vazio(): CompanyInput {
  return { name: "", category: null, city: null, state: null, phone: null, site: null, logo_url: null, description: null, ativo: true };
}

export default function GuiaClient({ itens }: { itens: Empresa[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<CompanyInput>(vazio());
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() { setEditId(null); setForm(vazio()); setAberto(true); }
  function abrirEdicao(c: Empresa) {
    setEditId(c.id);
    setForm({ name: c.name, category: c.category, city: c.city, state: c.state, phone: c.phone, site: c.site, logo_url: c.logo_url, description: c.description, ativo: c.ativo });
    setAberto(true);
  }

  async function salvar() {
    if (!form.name) { toast.error("Nome obrigatório"); return; }
    setSalvando(true);
    try {
      if (editId) await atualizarEmpresa(editId, form);
      else await criarEmpresa(form);
      toast.success("Empresa salva");
      setAberto(false);
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSalvando(false); }
  }

  async function remover(id: number) {
    if (!confirm("Excluir esta empresa?")) return;
    try { await excluirEmpresa(id); toast.success("Excluída"); router.refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={abrirNovo} className="bg-[#1A2B4A] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] text-sm">
          + Nova empresa
        </button>
      </div>

      <DataTable<Empresa>
        dados={itens}
        vazio="Nenhuma empresa no guia."
        colunas={[
          { chave: "logo_url", titulo: "Logo", render: (c) => c.logo_url ? <img src={c.logo_url} alt="" className="h-10 rounded object-contain" /> : "—" },
          { chave: "name", titulo: "Nome" },
          { chave: "category", titulo: "Categoria" },
          { chave: "city", titulo: "Cidade", render: (c) => c.city ? `${c.city}/${c.state ?? ""}` : "—" },
          { chave: "ativo", titulo: "Ativo", render: (c) => <Badge variant={c.ativo ? "sucesso" : "neutro"}>{c.ativo ? "Sim" : "Não"}</Badge> },
        ]}
        acoes={(c) => (
          <div className="flex gap-3 justify-end">
            <button onClick={() => abrirEdicao(c)} className="text-blue-700 hover:text-blue-900 text-xs font-medium">Editar</button>
            <button onClick={() => remover(c.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Excluir</button>
          </div>
        )}
      />

      <Modal aberto={aberto} titulo={editId ? "Editar empresa" : "Nova empresa"} onFechar={() => setAberto(false)}>
        <ImageUpload label="Logo" valor={form.logo_url} onChange={(url) => setForm((f) => ({ ...f, logo_url: url }))} />
        <FormField label="Nome">
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Categoria">
            <Input value={form.category ?? ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value || null }))} placeholder="Ex: Fornecedor, Integrador..." />
          </FormField>
          <FormField label="Telefone">
            <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value || null }))} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Cidade">
            <Input value={form.city ?? ""} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value || null }))} />
          </FormField>
          <FormField label="UF">
            <Input maxLength={2} value={form.state ?? ""} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value.toUpperCase() || null }))} />
          </FormField>
        </div>
        <FormField label="Site">
          <Input value={form.site ?? ""} onChange={(e) => setForm((f) => ({ ...f, site: e.target.value || null }))} placeholder="https://..." />
        </FormField>
        <FormField label="Descrição">
          <Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))} />
        </FormField>
        <label className="flex items-center gap-2 mb-4 text-sm">
          <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} />
          Exibir no guia
        </label>
        <button onClick={salvar} disabled={salvando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </Modal>
    </>
  );
}
