import ColunistasCarrossel from "@/components/ui/ColunistasCarrossel";

const COLUNISTAS = [
  { nome: "Ricardo Mendonça", slug: "ricardo-mendonca", especialidade: "Automação & Indústria 4.0", iniciais: "RM", cor: "bg-blue-700" },
  { nome: "Fernanda Castelo", slug: "fernanda-castelo", especialidade: "Gestão Industrial & Lean", iniciais: "FC", cor: "bg-amber-700" },
  { nome: "Carlos Drummond Neto", slug: "carlos-drummond-neto", especialidade: "Soldagem & Metalurgia", iniciais: "CD", cor: "bg-orange-700" },
  { nome: "Patrícia Sousa", slug: "patricia-sousa", especialidade: "Mercado & Investimentos", iniciais: "PS", cor: "bg-green-700" },
  { nome: "Marcos Vinicius Teixeira", slug: "marcos-vinicius-teixeira", especialidade: "Manutenção Preditiva", iniciais: "MV", cor: "bg-red-700" },
  { nome: "Juliana Faria", slug: "juliana-faria", especialidade: "ISO 9001 & Qualidade", iniciais: "JF", cor: "bg-purple-700" },
];

export default function FaixaColunistas() {
  return <ColunistasCarrossel colunistas={COLUNISTAS} />;
}
