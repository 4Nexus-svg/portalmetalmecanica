"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DataTable from "@/components/painel/DataTable";
import Modal from "@/components/painel/Modal";
import { FormField, Input, Textarea, Select } from "@/components/painel/FormField";
import Badge from "@/components/painel/Badge";
import {
  criarClassificado, atualizarClassificado, moderarClassificado, excluirClassificado,
  type ClassificadoInput,
} from "./actions";
import type { Database } from "@/types/database";

type Classificado = Database["public"]["Tables"]["classifieds"]["Row"];

const STATUS_FILTROS = ["todos", "pending", "active", "rejected"] as const;
type Filtro = typeof STATUS_FILTROS[number];

const BADGE: Record<string, "sucesso" | "alerta" | "perigo" | "neutro"> = {
  active: "sucesso", pending: "alerta", rejected: "perigo",
};

function vazio(): ClassificadoInput {
  return { title: "", description: null, price: null, category: null, city: null, state: null, phone: null, whatsapp: null, status: "active", expires_at: null };
}

export default function ClassificadosClient({ itens }: { itens: Classificado[] }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ClassificadoInput>(vazio());
  const [salvando, setSalvando] = useState(false);

  const filtrados = itens.filter((c) =>
    (filtro === "todos" || c.status === filtro) &&
    (busca === "" || c.title.toLowerCase().includes(busca.toLowerCase()))
  );

  function abrirNovo() { setEditId(null); setForm(vazio()); setAberto(true); }
  function abrirEdicao(c: Classificado) {
    setEditId(c.id);
    setForm({
      title: c.title, description: c.description, price: c.price, category: c.category,
      city: c.city, state: c.state, phone: c.phone, whatsapp: c.whatsapp,
      status: c.status, expires_at: c.expires_at,
    });
    setAberto(true);
  }

  async function salvar() {
    if (!form.title) { toast.error("Título obrigatório"); return; }
    setSalvando(true);
    try {
      if (editId) await atualizarClassificado(editId, form);
      else await criarClassificado(form);
      toast.success("Classificado salvo");
      setAberto(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally { setSalvando(false); }
  }

  async function moderar(id: number, status: "active" | "rejected") {
    try { await moderarClassificado(id, status); toast.success("Atualizado"); router.refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  async function remover(id: number) {
    if (!confirm("Excluir este classificado?")) return;
    try { await excluirClassificado(id); toast.success("Excluído"); router.refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2">
          {STATUS_FILTROS.map((f) => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize ${filtro === f ? "bg-[#1A2B4A] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título..."
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]" />
          <button onClick={abrirNovo} className="bg-[#1A2B4A] text-white font-semibold px-4 py-1.5 rounded-lg hover:bg-[#0f1e35] text-sm">
            + Novo
          </button>
        </div>
      </div>

      <DataTable<Classificado>
        dados={filtrados}
        vazio="Nenhum classificado."
        colunas={[
          { chave: "title", titulo: "Título" },
          { chave: "category", titulo: "Categoria" },
          { chave: "city", titulo: "Cidade", render: (c) => c.city ? `${c.city}/${c.state ?? ""}` : "—" },
          { chave: "price", titulo: "Preço", render: (c) => c.price != null ? `R$ ${Number(c.price).toLocaleString("pt-BR")}` : "—" },
          { chave: "status", titulo: "Status", render: (c) => <Badge variant={BADGE[c.status] ?? "neutro"}>{c.status}</Badge> },
        ]}
        acoes={(c) => (
          <div className="flex gap-2 justify-end">
            {c.status !== "active" && <button onClick={() => moderar(c.id, "active")} className="text-green-700 hover:text-green-900 text-xs font-medium">Aprovar</button>}
            {c.status !== "rejected" && <button onClick={() => moderar(c.id, "rejected")} className="text-amber-700 hover:text-amber-900 text-xs font-medium">Rejeitar</button>}
            <button onClick={() => abrirEdicao(c)} className="text-blue-700 hover:text-blue-900 text-xs font-medium">Editar</button>
            <button onClick={() => remover(c.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Excluir</button>
          </div>
        )}
      />

      <Modal aberto={aberto} titulo={editId ? "Editar classificado" : "Novo classificado"} onFechar={() => setAberto(false)}>
        <FormField label="Título">
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </FormField>
        <FormField label="Descrição">
          <Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Preço (R$)">
            <Input type="number" value={form.price ?? ""} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value ? parseFloat(e.target.value) : null }))} />
          </FormField>
          <FormField label="Categoria">
            <Input value={form.category ?? ""} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value || null }))} />
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
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Telefone">
            <Input value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value || null }))} />
          </FormField>
          <FormField label="WhatsApp">
            <Input value={form.whatsapp ?? ""} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value || null }))} />
          </FormField>
        </div>
        <FormField label="Status">
          <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ClassificadoInput["status"] }))}>
            <option value="active">active</option>
            <option value="pending">pending</option>
            <option value="rejected">rejected</option>
          </Select>
        </FormField>
        <button onClick={salvar} disabled={salvando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </Modal>
    </>
  );
}
