"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const PLANS = [
  {
    id: "monthly", label: "Mensal", price: "R$ 290", period: "/mes",
    features: ["Acesso a todos os conteudos exclusivos", "Downloads de PDFs", "Newsletter premium", "Cancele quando quiser"],
  },
  {
    id: "yearly", label: "Anual", price: "R$ 2.490", period: "/ano", badge: "MELHOR VALOR",
    features: ["Tudo do plano mensal", "2 meses gratis", "Acesso antecipado a relatorios", "Suporte prioritario"],
  },
];

export default function AssinaturaPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  async function handleCheckout(plan: string) {
    setLoading(plan);
    try {
      const res = await fetch("/api/assinatura/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (res.status === 401) { router.push("/login?next=/assinatura"); return; }
      if (!res.ok) throw new Error(data.error ?? "Erro desconhecido");
      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao iniciar pagamento");
    } finally {
      setLoading(null);
    }
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-brand mb-4">Assine o Portal Metalmecanica</h1>
        <p className="text-xl text-gray-600">Acesse conteudos exclusivos sobre o setor metalmecanico de ES e MG.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {PLANS.map((plan) => (
          <div key={plan.id} className={`card p-8 relative ${plan.badge ? "border-2 border-brand" : ""}`}>
            {plan.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-xs font-bold px-4 py-1 rounded-full">
                {plan.badge}
              </span>
            )}
            <h2 className="text-xl font-bold text-gray-900 mb-1">{plan.label}</h2>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold text-brand">{plan.price}</span>
              <span className="text-gray-500">{plan.period}</span>
            </div>
            <ul className="space-y-2 mb-8">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                  <span className="text-green-500 font-bold">+</span> {f}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleCheckout(plan.id)}
              disabled={!!loading}
              className={`w-full py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 ${
                plan.badge ? "bg-brand text-white hover:bg-brand-light" : "border-2 border-brand text-brand hover:bg-brand hover:text-white"
              }`}
            >
              {loading === plan.id ? "Redirecionando..." : "Assinar agora"}
            </button>
          </div>
        ))}
      </div>
      <p className="text-center text-sm text-gray-500 mt-8">Pagamento seguro via Stripe. Cancele a qualquer momento.</p>
    </main>
  );
}
