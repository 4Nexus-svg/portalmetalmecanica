"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import Link from "next/link";

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  async function enviar() {
    if (!email) { toast.error("Informe seu e-mail"); return; }
    setEnviando(true);
    const supabase = createClient();
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://portalmetalmecanica.vercel.app";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/auth/callback?next=/auth/definir-senha`,
    });
    setEnviando(false);
    if (error) { toast.error(error.message); return; }
    setEnviado(true);
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/logo.png" alt="Portal Metalmecânica" className="h-16 w-auto object-contain" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Recuperar senha</h1>
          <p className="text-sm text-gray-500 mt-1">Enviaremos um link para redefinir sua senha</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          {enviado ? (
            <div className="text-center space-y-3">
              <p className="text-sm text-gray-700">
                E-mail enviado para <strong>{email}</strong>. Verifique sua caixa de entrada e clique no link para redefinir sua senha.
              </p>
              <Link href="/login" className="block text-sm text-[#1A2B4A] font-medium hover:underline">
                Voltar ao login
              </Link>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]"
                  placeholder="seu@email.com"
                  onKeyDown={(e) => e.key === "Enter" && enviar()}
                />
              </div>
              <button
                onClick={enviar}
                disabled={enviando}
                className="w-full bg-[#C9A84C] text-white font-semibold py-2.5 rounded-lg hover:bg-[#b8973e] transition-colors disabled:opacity-50"
              >
                {enviando ? "Enviando..." : "Enviar link"}
              </button>
              <p className="text-center text-sm text-gray-500">
                <Link href="/login" className="text-[#1A2B4A] font-medium hover:underline">
                  Voltar ao login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
