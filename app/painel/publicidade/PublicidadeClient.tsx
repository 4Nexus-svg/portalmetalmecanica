"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DataTable from "@/components/painel/DataTable";
import Modal from "@/components/painel/Modal";
import { FormField, Input, Select } from "@/components/painel/FormField";
import ImageUpload from "@/components/painel/ImageUpload";
import Badge from "@/components/painel/Badge";
import { criarAd, atualizarAd, excluirAd, type AdInput } from "./actions";
import type { Database } from "@/types/database";

type Ad = Database["public"]["Tables"]["ads"]["Row"];

const POSICOES = ["top", "sidebar", "between", "footer"];

function vazio(): AdInput {
  return { name: "", image_url: null, link: null, position: "top", start_date: null, end_date: null, ordem: 0, duracao: 5 };
}

function statusAd(a: Ad): { texto: string; variante: "sucesso" | "alerta" | "neutro" } {
  const hoje = new Date().toISOString().split("T")[0];
  if (a.start_date && a.start_date > hoje) return { texto: "Agendado", variante: "alerta" };
  if (a.end_date && a.end_date < hoje) return { texto: "Expirado", variante: "neutro" };
  return { texto: "Vigente", variante: "sucesso" };
}

export default function PublicidadeClient({ ads }: { ads: Ad[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<AdInput>(vazio());
  const [salvando, setSalvando] = useState(false);

  function abrirNovo() {
    setEditId(null);
    setForm(vazio());
    setAberto(true);
  }

  function abrirEdicao(a: Ad) {
    setEditId(a.id);
    setForm({
      name: a.name ?? "",
      image_url: a.image_url,
      link: a.link,
      position: a.position ?? "top",
      start_date: a.start_date,
      end_date: a.end_date,
      ordem: a.ordem ?? 0,
      duracao: a.duracao ?? 5,
    });
    setAberto(true);
  }

  async function salvar() {
    if (!form.name) { toast.error("Nome obrigatório"); return; }
    setSalvando(true);
    try {
      if (editId) await atualizarAd(editId, form);
      else await criarAd(form);
      toast.success("Banner salvo");
      setAberto(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function remover(id: number) {
    if (!confirm("Excluir este banner?")) return;
    try {
      await excluirAd(id);
      toast.success("Banner excluído");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={abrirNovo} className="bg-[#1A2B4A] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] transition-colors text-sm">
          + Novo banner
        </button>
      </div>

      <DataTable<Ad>
        dados={ads}
        vazio="Nenhum banner cadastrado."
        colunas={[
          { chave: "image_url", titulo: "Imagem", render: (a) => a.image_url ? <img src={a.image_url} alt="" className="h-10 rounded object-contain" /> : "—" },
          { chave: "name", titulo: "Nome" },
          { chave: "position", titulo: "Posição" },
          { chave: "ordem", titulo: "Ordem" },
          { chave: "duracao", titulo: "Duração", render: (a) => `${a.duracao ?? 5}s` },
          { chave: "vigencia", titulo: "Vigência", render: (a) => `${a.start_date ?? "—"} → ${a.end_date ?? "—"}` },
          { chave: "impressions", titulo: "Impr." },
          { chave: "clicks", titulo: "Cliques" },
          { chave: "status", titulo: "Status", render: (a) => { const s = statusAd(a); return <Badge variant={s.variante}>{s.texto}</Badge>; } },
        ]}
        acoes={(a) => (
          <div className="flex gap-3 justify-end">
            <button onClick={() => abrirEdicao(a)} className="text-blue-700 hover:text-blue-900 text-xs font-medium">Editar</button>
            <button onClick={() => remover(a.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Excluir</button>
          </div>
        )}
      />

      <Modal aberto={aberto} titulo={editId ? "Editar banner" : "Novo banner"} onFechar={() => setAberto(false)}>
        <ImageUpload label="Imagem do banner" aceitaVideo valor={form.image_url} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />
        <FormField label="Nome">
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ex: Banner home topo" />
        </FormField>
        <FormField label="Link">
          <Input value={form.link ?? ""} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value || null }))} placeholder="https://..." />
        </FormField>
        <FormField label="Posição">
          <Select value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value as AdInput["position"] }))}>
            {POSICOES.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Ordem (sequência)">
            <Input type="number" min={0} value={form.ordem} onChange={(e) => setForm((f) => ({ ...f, ordem: Number(e.target.value) }))} />
          </FormField>
          <FormField label="Duração (segundos)">
            <Input type="number" min={1} max={60} value={form.duracao} onChange={(e) => setForm((f) => ({ ...f, duracao: Number(e.target.value) }))} />
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
        <button onClick={salvar} disabled={salvando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] transition-colors disabled:opacity-50">
          {salvando ? "Salvando..." : "Salvar"}
        </button>
      </Modal>
    </>
  );
}
