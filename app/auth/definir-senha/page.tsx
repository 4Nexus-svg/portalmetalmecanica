"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import Link from "next/link";

export default function DefinirSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [salvando, setSalvando] = useState(false);

  async function definir() {
    if (senha.length < 8) { toast.error("A senha deve ter ao menos 8 caracteres"); return; }
    if (senha !== confirmacao) { toast.error("As senhas não coincidem"); return; }
    setSalvando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Senha definida com sucesso!");
    router.push("/painel");
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/logo.png" alt="Portal Metalmecânica" className="h-16 w-auto object-contain" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Criar sua senha</h1>
          <p className="text-sm text-gray-500 mt-1">Defina uma senha para acessar o painel</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nova senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]"
              placeholder="Mínimo 8 caracteres"
              onKeyDown={(e) => e.key === "Enter" && definir()}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar senha</label>
            <input
              type="password"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]"
              placeholder="Repita a senha"
              onKeyDown={(e) => e.key === "Enter" && definir()}
            />
          </div>
          <button
            onClick={definir}
            disabled={salvando}
            className="w-full bg-[#C9A84C] text-white font-semibold py-2.5 rounded-lg hover:bg-[#b8973e] transition-colors disabled:opacity-50"
          >
            {salvando ? "Salvando..." : "Definir senha e entrar"}
          </button>
        </div>
      </div>
    </main>
  );
}
