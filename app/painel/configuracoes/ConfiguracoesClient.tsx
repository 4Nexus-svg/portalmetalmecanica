"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { FormField, Input } from "@/components/painel/FormField";
import { salvarConfiguracoes } from "./actions";

const CAMPOS: { key: string; label: string }[] = [
  { key: "site_name", label: "Nome do site" },
  { key: "contact_email", label: "E-mail de contato" },
  { key: "contact_phone", label: "Telefone de contato" },
  { key: "social_instagram", label: "Instagram (URL)" },
  { key: "social_linkedin", label: "LinkedIn (URL)" },
  { key: "social_youtube", label: "YouTube (URL)" },
  { key: "subscription_price", label: "Preço da assinatura mensal (R$)" },
];

export default function ConfiguracoesClient({ inicial }: { inicial: Record<string, string> }) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>(inicial);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await salvarConfiguracoes(form);
      toast.success("Configurações salvas");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 max-w-xl">
      {CAMPOS.map((c) => (
        <FormField key={c.key} label={c.label}>
          <Input value={form[c.key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [c.key]: e.target.value }))} />
        </FormField>
      ))}
      <button onClick={salvar} disabled={salvando} className="w-full bg-[#1A2B4A] text-white font-semibold py-2.5 rounded-lg hover:bg-[#0f1e35] disabled:opacity-50">
        {salvando ? "Salvando..." : "Salvar"}
      </button>
    </div>
  );
}
