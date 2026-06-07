"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DataTable from "@/components/painel/DataTable";
import Modal from "@/components/painel/Modal";
import { FormField, Input, Select } from "@/components/painel/FormField";
import { alterarPapel, convidarUsuario, type PapelDB } from "./actions";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const PAPEIS: PapelDB[] = ["admin", "editor", "comercial", "colunista", "user"];

export default function UsuariosClient({ usuarios, meuId }: { usuarios: Profile[]; meuId: string }) {
  const router = useRouter();
  const [convite, setConvite] = useState(false);
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<PapelDB>("editor");
  const [enviando, setEnviando] = useState(false);

  async function trocar(userId: string, papel: PapelDB) {
    try {
      await alterarPapel(userId, papel);
      toast.success("Papel atualizado");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  async function convidar() {
    setEnviando(true);
    try {
      await convidarUsuario(email, papel);
      toast.success("Convite enviado");
      setConvite(false);
      setEmail("");
      setPapel("editor");
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
        ]}
      />

      <Modal aberto={convite} titulo="Convidar usuário" onFechar={() => setConvite(false)}>
        <FormField label="E-mail">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@empresa.com" />
        </FormField>
        <FormField label="Papel">
          <Select value={papel} onChange={(e) => setPapel(e.target.value as PapelDB)}>
            {PAPEIS.filter(p => p !== "user").map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>
        </FormField>
        <button onClick={convidar} disabled={enviando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
          {enviando ? "Enviando..." : "Enviar convite"}
        </button>
      </Modal>
    </>
  );
}
