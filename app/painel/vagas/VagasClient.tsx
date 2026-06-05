"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DataTable from "@/components/painel/DataTable";
import Modal from "@/components/painel/Modal";
import { FormField, Input, Textarea } from "@/components/painel/FormField";
import Badge from "@/components/painel/Badge";
import { criarVaga, atualizarVaga, excluirVaga, type JobInput } from "./actions";
import type { Database } from "@/types/database";

type Vaga = Database["public"]["Tables"]["jobs"]["Row"];

function vazio(): JobInput {
  return { title: "", company: null, city: null, state: null, type: null, salary: null, description: null, link: null, contact_email: null, ativo: true, expires_at: null };
}

export default function VagasClient({ itens }: { itens: Vaga[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<JobInput>(vazio());
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() { setEditId(null); setForm(vazio()); setAberto(true); }
  function abrirEdicao(v: Vaga) {
    setEditId(v.id);
    setForm({ title: v.title, company: v.company, city: v.city, state: v.state, type: v.type, salary: v.salary, description: v.description, link: v.link, contact_email: v.contact_email, ativo: v.ativo, expires_at: v.expires_at });
    setAberto(true);
  }

  async function salvar() {
    if (!form.title) { toast.error("Título obrigatório"); return; }
    setSalvando(true);
    try {
      if (editId) await atualizarVaga(editId, form);
      else await criarVaga(form);
      toast.success("Vaga salva");
      setAberto(false);
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSalvando(false); }
  }

  async function remover(id: number) {
    if (!confirm("Excluir esta vaga?")) return;
    try { await excluirVaga(id); toast.success("Excluída"); router.refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={abrirNovo} className="bg-[#1A2B4A] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] text-sm">
          + Nova vaga
        </button>
      </div>

      <DataTable<Vaga>
        dados={itens}
        vazio="Nenhuma vaga."
        colunas={[
          { chave: "title", titulo: "Título" },
          { chave: "company", titulo: "Empresa" },
          { chave: "city", titulo: "Local", render: (v) => v.city ? `${v.city}/${v.state ?? ""}` : "—" },
          { chave: "type", titulo: "Tipo" },
          { chave: "expires_at", titulo: "Expira" },
          { chave: "ativo", titulo: "Ativa", render: (v) => <Badge variant={v.ativo ? "sucesso" : "neutro"}>{v.ativo ? "Sim" : "Não"}</Badge> },
        ]}
        acoes={(v) => (
          <div className="flex gap-3 justify-end">
            <button onClick={() => abrirEdicao(v)} className="text-blue-700 hover:text-blue-900 text-xs font-medium">Editar</button>
            <button onClick={() => remover(v.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Excluir</button>
          </div>
        )}
      />

      <Modal aberto={aberto} titulo={editId ? "Editar vaga" : "Nova vaga"} onFechar={() => setAberto(false)}>
        <FormField label="Título">
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Empresa">
            <Input value={form.company ?? ""} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value || null }))} />
          </FormField>
          <FormField label="Tipo">
            <Input value={form.type ?? ""} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value || null }))} placeholder="CLT, PJ, Estágio..." />
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
        <FormField label="Salário">
          <Input value={form.salary ?? ""} onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value || null }))} placeholder="A combinar / R$ ..." />
        </FormField>
        <FormField label="Descrição">
          <Textarea rows={4} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Link de candidatura">
            <Input value={form.link ?? ""} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value || null }))} placeholder="https://..." />
          </FormField>
          <FormField label="E-mail de contato">
            <Input value={form.contact_email ?? ""} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value || null }))} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Expira em">
            <Input type="date" value={form.expires_at ?? ""} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value || null }))} />
          </FormField>
          <FormField label="Ativa">
            <label className="flex items-center gap-2 mt-2 text-sm">
              <input type="checkbox" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} />
              Exibir no site
            </label>
          </FormField>
        </div>
        <button onClick={salvar} disabled={salvando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </Modal>
    </>
  );
}
