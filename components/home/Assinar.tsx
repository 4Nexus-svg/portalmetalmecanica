import Link from "next/link";

export default function Assinar({ preco }: { preco: string }) {
  return (
    <div className="bg-gradient-to-br from-[#C9A84C] to-[#b8973e] rounded-xl p-5 text-white">
      <h3 className="font-bold text-lg mb-1">Seja Assinante</h3>
      <p className="text-white/80 text-sm mb-4">Acesse conteúdos exclusivos do setor metalmecânico.</p>
      <div className="text-2xl font-black mb-1">R$ {preco}<span className="text-sm font-normal">/mês</span></div>
      <Link href="/assinatura" className="block w-full bg-[#1A2B4A] text-white font-bold py-2 rounded-lg hover:bg-[#0f1e35] transition-colors text-sm text-center mt-3">Assinar agora</Link>
    </div>
  );
}
