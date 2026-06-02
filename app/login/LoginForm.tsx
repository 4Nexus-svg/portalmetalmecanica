"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import Link from "next/link";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "" });

  async function handleSubmit() {
    if (!form.email || !form.password) { toast.error("Preencha e-mail e senha"); return; }
    setLoading(true);
    const supabase = createClient();

    if (isRegister) {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.name } },
      });
      if (error) { toast.error(error.message); setLoading(false); return; }
      toast.success("Conta criada! Verifique seu e-mail.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });

    setLoading(false);
    if (error) { toast.error("E-mail ou senha incorretos"); return; }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <img src="/logo.png" alt="Portal Metalmecânica" className="h-16 w-auto object-contain" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{isRegister ? "Criar conta" : "Entrar"}</h1>
          <p className="text-sm text-gray-500 mt-1">Portal Metalmecânica</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4">
          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]"
                placeholder="Seu nome completo" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]"
              placeholder="seu@email.com" onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1A2B4A]"
              placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && handleSubmit()} />
          </div>
          <button onClick={handleSubmit} disabled={loading}
            className="w-full bg-[#C9A84C] text-white font-semibold py-2.5 rounded-lg hover:bg-[#b8973e] transition-colors disabled:opacity-50">
            {loading ? "Aguarde..." : isRegister ? "Criar conta" : "Entrar"}
          </button>
          <p className="text-center text-sm text-gray-500">
            {isRegister ? "Já tem conta?" : "Não tem conta?"}{" "}
            <button onClick={() => setIsRegister(!isRegister)} className="text-[#1A2B4A] font-medium hover:underline">
              {isRegister ? "Entrar" : "Criar conta"}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}