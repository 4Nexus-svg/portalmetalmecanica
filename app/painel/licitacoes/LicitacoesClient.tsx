"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DataTable from "@/components/painel/DataTable";
import Modal from "@/components/painel/Modal";
import { FormField, Input, Textarea } from "@/components/painel/FormField";
import Badge from "@/components/painel/Badge";
import { criarLicitacao, atualizarLicitacao, excluirLicitacao, type LicitacaoInput } from "./actions";
import type { Database } from "@/types/database";

type Licitacao = Database["public"]["Tables"]["licitacoes_pncp"]["Row"];

function vazio(): LicitacaoInput {
  return {
    orgao_cnpj: "",
    orgao_nome: null,
    uf: "ES",
    objeto: null,
    modalidade: null,
    valor_estimado: null,
    data_publicacao: null,
    data_encerramento: null,
    status: "aberta",
    link_pncp: null,
  };
}

export default function LicitacoesClient({ itens }: { itens: Licitacao[] }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<LicitacaoInput>(vazio());
  const [salvando, setSalvando] = useState(false);

  function set(k: keyof LicitacaoInput, v: unknown) {
    setForm((f) => ({ ...f, [k]: v === "" ? null : v }));
  }

  function abrirNovo() { setEditId(null); setForm(vazio()); setAberto(true); }
  function abrirEdicao(l: Licitacao) {
    setEditId(l.id);
    setForm({
      orgao_cnpj: l.orgao_cnpj,
      orgao_nome: l.orgao_nome,
      uf: l.uf,
      objeto: l.objeto,
      modalidade: l.modalidade,
      valor_estimado: l.valor_estimado,
      data_publicacao: l.data_publicacao,
      data_encerramento: l.data_encerramento,
      status: l.status,
      link_pncp: l.link_pncp,
    });
    setAberto(true);
  }

  async function salvar() {
    if (!form.objeto) { toast.error("Objeto obrigatório"); return; }
    if (!form.uf)     { toast.error("UF obrigatória"); return; }
    setSalvando(true);
    try {
      if (editId) await atualizarLicitacao(editId, form);
      else await criarLicitacao(form);
      toast.success("Licitação salva");
      setAberto(false);
      router.refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSalvando(false); }
  }

  async function remover(id: string) {
    if (!confirm("Excluir esta licitação?")) return;
    try { await excluirLicitacao(id); toast.success("Excluída"); router.refresh(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button
          onClick={abrirNovo}
          className="bg-[#1A2B4A] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] text-sm"
        >
          + Nova licitação
        </button>
      </div>

      <DataTable<Licitacao>
        dados={itens}
        vazio="Nenhuma licitação cadastrada."
        colunas={[
          { chave: "objeto",    titulo: "Objeto",    render: (l) => <span className="line-clamp-1">{l.objeto ?? "—"}</span> },
          { chave: "orgao_nome", titulo: "Órgão",   render: (l) => l.orgao_nome ?? l.orgao_cnpj },
          { chave: "uf",        titulo: "UF" },
          { chave: "modalidade", titulo: "Modalidade", render: (l) => l.modalidade ?? "—" },
          { chave: "data_encerramento", titulo: "Encerra em", render: (l) => l.data_encerramento ? new Date(l.data_encerramento + "T12:00:00").toLocaleDateString("pt-BR") : "—" },
          { chave: "status",    titulo: "Status",    render: (l) => <Badge variant={l.status === "aberta" ? "sucesso" : "neutro"}>{l.status === "aberta" ? "Aberta" : "Encerrada"}</Badge> },
        ]}
        acoes={(l) => (
          <div className="flex gap-3 justify-end">
            <button onClick={() => abrirEdicao(l)} className="text-blue-700 hover:text-blue-900 text-xs font-medium">Editar</button>
            <button onClick={() => remover(l.id)} className="text-red-600 hover:text-red-800 text-xs font-medium">Excluir</button>
          </div>
        )}
      />

      <Modal aberto={aberto} titulo={editId ? "Editar licitação" : "Nova licitação"} onFechar={() => setAberto(false)}>
        <div className="space-y-3">
          <FormField label="Objeto *">
            <Textarea value={form.objeto ?? ""} onChange={(e) => set("objeto", e.target.value)} rows={3} placeholder="Descrição do objeto da licitação" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="UF *">
              <select value={form.uf} onChange={(e) => set("uf", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="ES">Espírito Santo</option>
                <option value="MG">Minas Gerais</option>
              </select>
            </FormField>
            <FormField label="Status">
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="aberta">Aberta</option>
                <option value="encerrada">Encerrada</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="CNPJ do órgão">
              <Input value={form.orgao_cnpj} onChange={(e) => set("orgao_cnpj", e.target.value)} placeholder="00.000.000/0001-00" />
            </FormField>
            <FormField label="Nome do órgão">
              <Input value={form.orgao_nome ?? ""} onChange={(e) => set("orgao_nome", e.target.value)} placeholder="Ex: UFES" />
            </FormField>
          </div>

          <FormField label="Modalidade">
            <Input value={form.modalidade ?? ""} onChange={(e) => set("modalidade", e.target.value)} placeholder="Ex: Pregão Eletrônico" />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Valor estimado (R$)">
              <Input
                type="number"
                value={form.valor_estimado ?? ""}
                onChange={(e) => set("valor_estimado", e.target.value ? Number(e.target.value) : null)}
                placeholder="0,00"
              />
            </FormField>
            <FormField label="Data encerramento">
              <Input type="date" value={form.data_encerramento ?? ""} onChange={(e) => set("data_encerramento", e.target.value)} />
            </FormField>
          </div>

          <FormField label="Data publicação">
            <Input type="date" value={form.data_publicacao ?? ""} onChange={(e) => set("data_publicacao", e.target.value)} />
          </FormField>

          <FormField label="Link no PNCP">
            <Input value={form.link_pncp ?? ""} onChange={(e) => set("link_pncp", e.target.value)} placeholder="https://pncp.gov.br/app/editais/..." />
          </FormField>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={() => setAberto(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancelar</button>
          <button onClick={salvar} disabled={salvando} className="bg-[#1A2B4A] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </Modal>
    </>
  );
}
