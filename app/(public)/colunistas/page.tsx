import Link from "next/link";

const COLUNISTAS = [
  {
    id: 1,
    nome: "Ricardo Mendonça",
    slug: "ricardo-mendonca",
    cargo: "Engenheiro de Automação Industrial",
    especialidade: "Automação & Indústria 4.0",
    bio: "Mais de 20 anos de experiência em automação industrial. Especialista em CLP, SCADA e sistemas de controle para grandes plantas industriais do ES e MG.",
    iniciais: "RM",
    cor: "bg-blue-700",
    ultimas: ["Como escolher o CLP certo para sua fábrica", "Indústria 4.0 no ES: quem já está preparado?", "Os 5 erros mais caros na automação industrial"],
  },
  {
    id: 2,
    nome: "Fernanda Castelo",
    slug: "fernanda-castelo",
    cargo: "Diretora de Operações",
    especialidade: "Gestão Industrial & Lean",
    bio: "Especialista em Lean Manufacturing e TPM. Consultora para indústrias de médio e grande porte. Doutora em Engenharia de Produção pela UFMG.",
    iniciais: "FC",
    cor: "bg-amber-700",
    ultimas: ["Lean na prática: o que realmente funciona no chão de fábrica", "TPM sem segredo: guia para iniciar amanhã", "Por que seu Kaizen não está dando resultado"],
  },
  {
    id: 3,
    nome: "Carlos Drummond Neto",
    slug: "carlos-drummond-neto",
    cargo: "Especialista em Soldagem",
    especialidade: "Soldagem & Metalurgia",
    bio: "Inspetor de soldagem nível 3 pelo IIW. Colunista técnico especializado em processos de soldagem MIG, TIG, SAW e soldagem robotizada.",
    iniciais: "CD",
    cor: "bg-orange-700",
    ultimas: ["MIG vs TIG: qual processo escolher em 2025?", "Soldagem robotizada: vale o investimento?", "Defeitos de soldagem que todo técnico deve conhecer"],
  },
  {
    id: 4,
    nome: "Patrícia Sousa",
    slug: "patricia-sousa",
    cargo: "Analista de Mercado Industrial",
    especialidade: "Mercado & Investimentos",
    bio: "Economista especializada no setor industrial de ES e MG. Acompanha indicadores de produção, emprego e investimentos na indústria regional há 15 anos.",
    iniciais: "PS",
    cor: "bg-green-700",
    ultimas: ["Espírito Santo vai receber R$ 2,4 bi em novas indústrias", "O mercado de aço em 2025: o que esperar", "Onde estão as melhores vagas industriais do ES"],
  },
  {
    id: 5,
    nome: "Marcos Vinicius Teixeira",
    slug: "marcos-vinicius-teixeira",
    cargo: "Técnico em Manutenção Industrial",
    especialidade: "Manutenção Preditiva",
    bio: "30 anos de chão de fábrica. Referência em manutenção preditiva, análise de vibração e termografia industrial. Voz dos técnicos no portal.",
    iniciais: "MV",
    cor: "bg-red-700",
    ultimas: ["Análise de vibração: o guia que ninguém te deu", "Como montar um plano de manutenção preditiva do zero", "Quanto custa 1 hora de parada na sua linha?"],
  },
  {
    id: 6,
    nome: "Juliana Faria",
    slug: "juliana-faria",
    cargo: "Consultora em Qualidade",
    especialidade: "ISO 9001 & Qualidade Industrial",
    bio: "Auditora líder ISO 9001 e ISO 14001. Consultora em sistemas de gestão da qualidade para o setor metal-mecânico e de bebidas.",
    iniciais: "JF",
    cor: "bg-purple-700",
    ultimas: ["ISO 9001:2025 — o que muda para a indústria", "Como preparar sua fábrica para uma auditoria sem stress", "Qualidade com baixo custo: é possível?"],
  },
  {
    id: 7,
    nome: "André Lopes",
    slug: "andre-lopes",
    cargo: "Engenheiro Eletricista",
    especialidade: "Energia & Eficiência Energética",
    bio: "Especialista em eficiência energética industrial. Projetos de redução de consumo e geração distribuída para indústrias de grande porte em MG.",
    iniciais: "AL",
    cor: "bg-yellow-700",
    ultimas: ["Como reduzir 30% da conta de energia da sua fábrica", "Energia solar na indústria: vale a pena em 2025?", "Gestão de demanda: o que toda indústria deveria fazer"],
  },
  {
    id: 8,
    nome: "Renata Oliveira",
    slug: "renata-oliveira",
    cargo: "Especialista em RH Industrial",
    especialidade: "Carreira & Mercado de Trabalho",
    bio: "Head de RH com foco no setor industrial. Especialista em atração de talentos técnicos, salários do setor e desenvolvimento de lideranças industriais.",
    iniciais: "RO",
    cor: "bg-pink-700",
    ultimas: ["Quanto ganha um técnico HEUFT em 2025?", "As profissões industriais mais bem pagas do ES", "Por que os técnicos estão deixando a indústria"],
  },
  {
    id: 9,
    nome: "Fábio Nascimento",
    slug: "fabio-nascimento",
    cargo: "Especialista em Logística Industrial",
    especialidade: "Supply Chain & Logística",
    bio: "15 anos em supply chain industrial. Especialista em gestão de estoques, logística de insumos e distribuição para o setor metalmecânico.",
    iniciais: "FN",
    cor: "bg-teal-700",
    ultimas: ["Supply chain industrial: os gargalos de 2025", "Como reduzir o estoque sem parar a produção", "Logística reversa na indústria: obrigação ou oportunidade?"],
  },
  {
    id: 10,
    nome: "Wellington Costa",
    slug: "wellington-costa",
    cargo: "Especialista em Segurança do Trabalho",
    especialidade: "NRs & Segurança Industrial",
    bio: "Técnico e engenheiro de segurança do trabalho com 25 anos de experiência. Especialista nas NRs do setor metalmecânico e petroquímico.",
    iniciais: "WC",
    cor: "bg-slate-700",
    ultimas: ["NR-12 atualizada: o que sua empresa precisa fazer agora", "Os 10 acidentes mais comuns na metalurgia", "CIPA na prática: além do quadro de avisos"],
  },
];

export default function ColunistasPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 py-10">
      <div className="border-l-4 border-[#C9A84C] pl-4 mb-10">
        <h1 className="text-3xl font-bold text-[#1A2B4A]">Colunistas</h1>
        <p className="text-gray-500 mt-1">Especialistas que movem a indústria do ES e MG</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {COLUNISTAS.map((col) => (
          <div key={col.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-14 h-14 rounded-full ${col.cor} flex items-center justify-center flex-shrink-0`}>
                  <span className="text-white font-bold text-lg">{col.iniciais}</span>
                </div>
                <div>
                  <h2 className="font-bold text-[#1A2B4A] text-lg leading-tight">{col.nome}</h2>
                  <p className="text-xs text-[#C9A84C] font-semibold mt-0.5">{col.especialidade}</p>
                  <p className="text-xs text-gray-500">{col.cargo}</p>
                </div>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed mb-4">{col.bio}</p>

              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Últimas colunas</p>
                <ul className="space-y-1.5">
                  {col.ultimas.map((titulo) => (
                    <li key={titulo}>
                      <Link href={"/colunistas/" + col.slug} className="text-sm text-[#1A2B4A] hover:text-[#C9A84C] transition-colors line-clamp-1">
                        {titulo}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}