"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DataTable from "@/components/painel/DataTable";
import Modal from "@/components/painel/Modal";
import { FormField, Input, Textarea, Select } from "@/components/painel/FormField";
import ImageUpload from "@/components/painel/ImageUpload";
import Badge from "@/components/painel/Badge";
import { criarEvento, atualizarEvento, excluirEvento, type EventoInput, type EventoTipo } from "./actions";
import type { Database } from "@/types/database";

type Evento = Database["public"]["Tables"]["events"]["Row"];

const TIPOS: EventoTipo[] = ["feira", "congresso", "seminario", "workshop", "treinamento"];

function vazio(): EventoInput {
  return { title: "", slug: "", description: null, type: "feira", date_start: "", date_end: null, city: null, state: null, organizer: null, image_url: null };
}

export default function EventosClient({ itens }: { itens: Evento[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<EventoInput>(vazio());
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() { setEditId(null); setForm(vazio()); setAberto(true); }
  function abrirEdicao(e: Evento) {
    setEditId(e.id);
    setForm({ title: e.title, slug: e.slug, description: e.description, type: e.type, date_start: e.date_start, date_end: e.date_end, city: e.city, state: e.state, organizer: e.organizer, image_url: e.image_url });
    setAberto(true);
  }

  async function salvar() {
    if (!form.title) { toast.error("Título obrigatório"); return; }
    if (!form.date_start) { toast.error("Data de início obrigatória"); return; }
    setSalvando(true);
    try {
      if (editId) await atualizarEvento(editId, form);
      else await criarEvento(form);
      toast.success("Evento salvo");
      setAberto(false);
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSalvando(false); }
  }

  async function remover(id: number) {
    if (!confirm("Excluir este evento?")) return;
    try { await excluirEvento(id); toast.success("Excluído"); router.refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={abrirNovo} className="bg-[#1A2B4A] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] text-sm">
          + Novo evento
        </button>
      </div>

      <DataTable<Evento>
        dados={itens}
        vazio="Nenhum evento."
        colunas={[
          { chave: "image_url", titulo: "Imagem", render: (e) => e.image_url ? <img src={e.image_url} alt="" className="h-10 rounded object-cover" /> : "—" },
          { chave: "title", titulo: "Título" },
          { chave: "type", titulo: "Tipo" },
          { chave: "date_start", titulo: "Início" },
          { chave: "city", titulo: "Local", render: (e) => e.city ? `${e.city}/${e.state ?? ""}` : "—" },
          { chave: "is_auto", titulo: "Origem", render: (e) => <Badge variant={e.is_auto ? "info" : "neutro"}>{e.is_auto ? "Auto" : "Manual"}</Badge> },
        ]}
        acoes={(e) => (
          <div className="flex gap-3 justify-end">
            <button onClick={() => abrirEdicao(e)} className="text-blue-700 hover:text-blue-900 text-xs font-medium">Editar</button>
            <button onClick={() => remover(e.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Excluir</button>
          </div>
        )}
      />

      <Modal aberto={aberto} titulo={editId ? "Editar evento" : "Novo evento"} onFechar={() => setAberto(false)}>
        <ImageUpload label="Imagem" valor={form.image_url} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />
        <FormField label="Título">
          <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </FormField>
        <FormField label="Slug (deixe vazio para gerar do título)">
          <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
        </FormField>
        <FormField label="Descrição">
          <Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value || null }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Tipo">
            <Select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as EventoTipo }))}>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </FormField>
          <FormField label="Organizador">
            <Input value={form.organizer ?? ""} onChange={(e) => setForm((f) => ({ ...f, organizer: e.target.value || null }))} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Início">
            <Input type="date" value={form.date_start} onChange={(e) => setForm((f) => ({ ...f, date_start: e.target.value }))} />
          </FormField>
          <FormField label="Fim">
            <Input type="date" value={form.date_end ?? ""} onChange={(e) => setForm((f) => ({ ...f, date_end: e.target.value || null }))} />
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
        <button onClick={salvar} disabled={salvando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </Modal>
    </>
  );
}
