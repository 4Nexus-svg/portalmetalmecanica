import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";

interface Props {
  params: Promise<{ slug: string[] }>;
}

const SECOES: Record<string, string> = {
  setores:    "Setores Industriais",
  mercado:    "Mercado",
  vagas:      "Vagas de Emprego",
  indicadores:"Indicadores",
  opiniao:    "Opinião",
  guia:       "Guia Industrial",
  fornecedores:"Fornecedores",
  eventos:    "Eventos",
  midia:      "Mídia",
  especiais:  "Especiais",
  comunidade: "Comunidade",
};

function nomeDaSecao(segmentos: string[]): string {
  const primeiro = segmentos[0] ?? "";
  const secao = SECOES[primeiro];
  if (!secao) return "Esta seção";

  if (segmentos.length > 1) {
    const sub = segmentos[segmentos.length - 1]
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return sub;
  }

  return secao;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const nome = nomeDaSecao(slug);
  return {
    title: `${nome} — Em Breve | Portal Metalmecânica`,
  };
}

export default async function EmBreve({ params }: Props) {
  const { slug } = await params;
  const nome = nomeDaSecao(slug);
  const secaoLabel = SECOES[slug[0]] ?? "Portal Metalmecânica";

  return (
    <main className="max-w-2xl mx-auto px-4 py-20 text-center">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1A2B4A] mb-12 transition-colors"
      >
        <ArrowLeft size={16} /> Voltar ao início
      </Link>

      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 rounded-full bg-[#1A2B4A]/10 flex items-center justify-center">
          <Clock size={28} className="text-[#1A2B4A]" />
        </div>
      </div>

      <div className="inline-block bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
        {secaoLabel}
      </div>

      <h1 className="text-3xl font-bold text-[#1A2B4A] mb-4">{nome}</h1>

      <p className="text-gray-500 leading-relaxed mb-8">
        Esta seção está sendo preparada com conteúdo exclusivo para profissionais do setor metalmecânico.
        Em breve você encontrará aqui informações relevantes, atualizadas e aprofundadas.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/noticias"
          className="bg-[#1A2B4A] text-white font-semibold px-6 py-3 rounded-lg hover:bg-[#0f1e35] transition-colors"
        >
          Ver últimas notícias
        </Link>
        <Link
          href="/assinatura"
          className="border-2 border-[#C9A84C] text-[#C9A84C] font-semibold px-6 py-3 rounded-lg hover:bg-[#C9A84C] hover:text-white transition-colors"
        >
          Assinar o portal
        </Link>
      </div>
    </main>
  );
}
