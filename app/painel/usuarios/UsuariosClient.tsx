"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DataTable from "@/components/painel/DataTable";
import Modal from "@/components/painel/Modal";
import { FormField, Input, Select } from "@/components/painel/FormField";
import { alterarPapel, convidarUsuario, excluirUsuario, buscarColunistasLivres, type PapelDB } from "./actions";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const PAPEIS: PapelDB[] = ["admin", "editor", "comercial", "colunista", "user"];

type ColunistaLivre = { id: number; nome: string };

export default function UsuariosClient({ usuarios, meuId }: { usuarios: Profile[]; meuId: string }) {
  const router = useRouter();
  const [convite, setConvite] = useState(false);
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<PapelDB>("editor");
  const [columnistId, setColumnistId] = useState<number | null>(null);
  const [colunistasLivres, setColunistasLivres] = useState<ColunistaLivre[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [excluindo, setExcluindo] = useState<string | null>(null);

  useEffect(() => {
    buscarColunistasLivres().then(setColunistasLivres).catch(() => {});
  }, []);

  async function trocar(userId: string, papel: PapelDB) {
    try {
      await alterarPapel(userId, papel);
      toast.success("Papel atualizado");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function confirmarExclusao(userId: string) {
    try {
      await excluirUsuario(userId);
      toast.success("Usuário excluído");
      setExcluindo(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
      setExcluindo(null);
    }
  }

  async function convidar() {
    setEnviando(true);
    try {
      await convidarUsuario(email, papel, columnistId);
      toast.success("Convite enviado");
      setConvite(false);
      setEmail("");
      setPapel("editor");
      setColumnistId(null);
      buscarColunistasLivres().then(setColunistasLivres).catch(() => {});
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao convidar");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={() => setConvite(true)} className="bg-[#1A2B4A] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#0f1e35] text-sm">
          + Convidar usuário
        </button>
      </div>

      <DataTable<Profile>
        dados={usuarios}
        vazio="Nenhum usuário."
        colunas={[
          { chave: "name", titulo: "Nome", render: (p) => p.name ?? "—" },
          { chave: "email", titulo: "E-mail", render: (p) => p.email ?? "—" },
          {
            chave: "role", titulo: "Papel", render: (p) => (
              <Select value={p.role} onChange={(e) => trocar(p.id, e.target.value as PapelDB)}>
                {PAPEIS.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            ),
          },
          {
            chave: "id", titulo: "", render: (p) => p.id === meuId ? null : (
              <button
                onClick={() => setExcluindo(p.id)}
                className="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Excluir
              </button>
            ),
          },
        ]}
      />

      <Modal aberto={!!excluindo} titulo="Confirmar exclusão" onFechar={() => setExcluindo(null)}>
        <p className="text-sm text-gray-700 mb-4">Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.</p>
        <div className="flex gap-3">
          <button onClick={() => setExcluindo(null)} className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-lg hover:bg-gray-50 text-sm">
            Cancelar
          </button>
          <button onClick={() => excluindo && confirmarExclusao(excluindo)} className="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-lg hover:bg-red-700 text-sm">
            Excluir
          </button>
        </div>
      </Modal>

      <Modal aberto={convite} titulo="Convidar usuário" onFechar={() => setConvite(false)}>
        <FormField label="E-mail">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@empresa.com" />
        </FormField>
        <FormField label="Papel">
          <Select value={papel} onChange={(e) => { setPapel(e.target.value as PapelDB); if (e.target.value !== "colunista") setColumnistId(null); }}>
            {PAPEIS.filter(p => p !== "user").map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </FormField>
        {papel === "colunista" && colunistasLivres.length > 0 && (
          <FormField label="Vincular ao colunista existente (opcional)">
            <Select value={columnistId ?? ""} onChange={(e) => setColumnistId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Não vincular agora —</option>
              {colunistasLivres.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </FormField>
        )}
        <button onClick={convidar} disabled={enviando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
          {enviando ? "Enviando..." : "Enviar convite"}
        </button>
      </Modal>
    </>
  );
}
