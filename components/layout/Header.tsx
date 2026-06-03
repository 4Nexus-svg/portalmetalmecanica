"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, ChevronDown } from "lucide-react";
import SearchBar from "@/components/ui/SearchBar";

const CANAIS = [
  {
    label: "Notícias",
    href: "/noticias",
    submenu: [
      { label: "Espírito Santo", href: "/noticias/es" },
      { label: "Minas Gerais", href: "/noticias/mg" },
      { label: "Brasil Industrial", href: "/noticias/brasil" },
      { label: "Economia", href: "/noticias/economia" },
      { label: "Tecnologia", href: "/noticias/tecnologia" },
      { label: "Sustentabilidade", href: "/noticias/sustentabilidade" },
      { label: "Segurança do Trabalho", href: "/noticias/seguranca" },
      { label: "Últimas Notícias", href: "/noticias" },
    ],
  },
  {
    label: "Setores",
    href: "/setores",
    submenu: [
      { label: "Metalmecânica", href: "/setores/metalmecanica" },
      { label: "Automação Industrial", href: "/setores/automacao" },
      { label: "Soldagem", href: "/setores/soldagem" },
      { label: "Manutenção", href: "/setores/manutencao" },
      { label: "Energia", href: "/setores/energia" },
      { label: "Mineração", href: "/setores/mineracao" },
      { label: "Siderurgia", href: "/setores/siderurgia" },
      { label: "Petróleo & Gás", href: "/setores/petroleo-gas" },
      { label: "Papel e Celulose", href: "/setores/papel-celulose" },
      { label: "Logística", href: "/setores/logistica" },
      { label: "Alimentos e Bebidas", href: "/setores/alimentos-bebidas" },
      { label: "Construção Industrial", href: "/setores/construcao" },
    ],
  },
  {
    label: "Mercado",
    href: "/mercado",
    submenu: [
      { label: "Vagas de Emprego", href: "/vagas" },
      { label: "Novas Fábricas", href: "/mercado/fabricas" },
      { label: "Investimentos", href: "/mercado/investimentos" },
      { label: "Licitações", href: "/mercado/licitacoes" },
      { label: "Fusões e Aquisições", href: "/mercado/fusoes" },
      { label: "Exportação", href: "/mercado/exportacao" },
      { label: "Importação", href: "/mercado/importacao" },
      { label: "Carreira Industrial", href: "/mercado/carreira" },
      { label: "Cursos e Treinamentos", href: "/mercado/cursos" },
    ],
  },
  {
    label: "Indicadores",
    href: "/indicadores",
    submenu: [
      { label: "Dólar", href: "/indicadores/dolar" },
      { label: "Euro", href: "/indicadores/euro" },
      { label: "Ibovespa", href: "/indicadores/ibovespa" },
      { label: "Selic", href: "/indicadores/selic" },
      { label: "Petróleo Brent", href: "/indicadores/petroleo" },
      { label: "Minério de Ferro", href: "/indicadores/minerio" },
      { label: "Aço", href: "/indicadores/aco" },
      { label: "Alumínio", href: "/indicadores/aluminio" },
      { label: "Cobre", href: "/indicadores/cobre" },
     { label: "Exportações ES & MG", href: "/indicadores/exportacoes" },
      { label: "Produção Industrial ES & MG", href: "/indicadores/producao" },
      
    ],
  },
  {
    label: "Opinião",
    href: "/opiniao",
    submenu: [
      { label: "Colunistas", href: "/colunistas" },
      { label: "Artigos Técnicos", href: "/opiniao/artigos" },
      { label: "Entrevistas", href: "/opiniao/entrevistas" },
      { label: "Especialistas", href: "/opiniao/especialistas" },
      { label: "Cases de Sucesso", href: "/opiniao/cases" },
      { label: "Tendências Industriais", href: "/opiniao/tendencias" },
    ],
  },
  {
    label: "Guia Industrial",
    href: "/guia",
    submenu: [
      { label: "Fornecedores", href: "/fornecedores" },
      { label: "Classificados", href: "/classificados" },
      { label: "Empresas em Destaque", href: "/guia/empresas" },
      { label: "Prestadores de Serviço", href: "/guia/prestadores" },
      { label: "Fabricantes", href: "/guia/fabricantes" },
      { label: "Integradores", href: "/guia/integradores" },
      { label: "Consultorias", href: "/guia/consultorias" },
      { label: "Catálogo Industrial", href: "/guia/catalogo" },
    ],
  },
  {
    label: "Eventos",
    href: "/eventos",
    submenu: [
      { label: "Feiras", href: "/eventos/feiras" },
      { label: "Congressos", href: "/eventos/congressos" },
      { label: "Seminários", href: "/eventos/seminarios" },
      { label: "Workshops", href: "/eventos/workshops" },
      { label: "Treinamentos", href: "/eventos/treinamentos" },
      { label: "Agenda Industrial ES", href: "/eventos/agenda-es" },
      { label: "Agenda Industrial MG", href: "/eventos/agenda-mg" },
      { label: "Calendário de Eventos", href: "/eventos/calendario" },
    ],
  },
  {
    label: "Mídia",
    href: "/midia",
    submenu: [
      { label: "Podcasts", href: "/midia/podcasts" },
      { label: "Entrevistas", href: "/midia/entrevistas" },
      { label: "Vídeos", href: "/midia/videos" },
      { label: "Shorts", href: "/midia/shorts" },
      { label: "Reels", href: "/midia/reels" },
      { label: "Webinars", href: "/midia/webinars" },
      { label: "TV MetalMecânica", href: "/midia/tv" },
      { label: "Newsletter", href: "/midia/newsletter" },
    ],
  },
  {
    label: "Especiais",
    href: "/especiais",
    submenu: [
      { label: "Indústria 4.0", href: "/especiais/industria-40" },
      { label: "Inteligência Artificial", href: "/especiais/ia" },
      { label: "Mulheres na Indústria", href: "/especiais/mulheres" },
      { label: "Gigantes da Indústria", href: "/especiais/gigantes" },
      { label: "Ranking Industrial ES", href: "/especiais/ranking-es" },
      { label: "Ranking Industrial MG", href: "/especiais/ranking-mg" },
      { label: "Anuário Industrial", href: "/especiais/anuario" },
    ],
  },
  {
    label: "Comunidade",
    href: "/comunidade",
    submenu: [
      { label: "Fórum Industrial", href: "/comunidade/forum" },
      { label: "Networking", href: "/comunidade/networking" },
      { label: "Enquete da Semana", href: "/comunidade/enquete" },
      { label: "Banco de Currículos", href: "/comunidade/curriculos" },
      { label: "Clube MetalMecânica", href: "/comunidade/clube" },
    ],
  },
];
export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => {
      if (window.scrollY > 80) setScrolled(true);
      else if (window.scrollY < 40) setScrolled(false);
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 shadow-md w-full">

      {/* Faixa superior branca — logo centralizada */}
      <div className="bg-white border-b border-gray-100 transition-all duration-300">
        <div className={`max-w-7xl mx-auto px-4 flex items-center justify-between transition-all duration-300 ${scrolled ? "py-2" : "py-6"}`}>

          {/* Esquerda: busca */}
          <div className="flex items-center gap-2 w-32">
            <SearchBar />
          </div>

          {/* Centro: logo + slogan */}
          <Link href="/" className="flex flex-col items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Portal Metalmecânica"
              className={`w-auto object-contain transition-all duration-300 ${scrolled ? "h-10" : "h-20"}`}
            />
            <span className={`text-xs font-medium tracking-widest text-[#C9A84C] uppercase mt-1 transition-all duration-300 ${scrolled ? "opacity-0 h-0 overflow-hidden mt-0" : "opacity-100"}`}>
              Informações que movem a Indústria
            </span>
          </Link>

          {/* Direita: entrar + assinar */}
          <div className="flex items-center gap-3 w-32 justify-end">
            <Link href="/login" className="hidden sm:block text-sm font-medium text-[#1A2B4A] hover:underline whitespace-nowrap">
              Entrar
            </Link>
            <Link
              href="/assinatura"
              className="bg-[#C9A84C] text-white text-xs font-bold px-3 py-2 rounded hover:bg-[#b8973e] transition-colors uppercase tracking-wide whitespace-nowrap"
            >
              Assinar
            </Link>
            {/* Hamburger mobile */}
            <button className="md:hidden p-1 text-gray-600" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>

        </div>
      </div>

      {/* Linha dourada */}
      <div className="h-1 bg-gradient-to-r from-[#C9A84C] via-[#e8c97a] to-[#C9A84C]" />

      {/* Nav canais azul escuro — desktop */}
      <div className="hidden md:block bg-[#1A2B4A]">
        <div className="max-w-7xl mx-auto px-2">
          <nav className="flex items-center justify-center">
            {CANAIS.map((canal) => (
              <div
                key={canal.label}
                className="relative group"
                onMouseEnter={() => setActiveSubmenu(canal.label)}
                onMouseLeave={() => setActiveSubmenu(null)}
              >
                <Link
                  href={canal.href}
                  className="flex items-center gap-1 px-3 py-3 text-sm font-medium text-gray-200 hover:text-[#C9A84C] hover:bg-[#0f1e35] transition-colors whitespace-nowrap"
                >
                  {canal.label}
                  {canal.submenu && <ChevronDown size={13} className="opacity-60" />}
                </Link>

                {canal.submenu && activeSubmenu === canal.label && (
                  <div className="absolute top-full left-0 bg-white border border-gray-100 shadow-xl rounded-b-lg min-w-48 z-50">
                    {canal.submenu.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="block px-4 py-2.5 text-sm text-gray-700 hover:bg-[#1A2B4A] hover:text-white transition-colors border-b border-gray-50 last:border-0"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Nav mobile */}
      {menuOpen && (
        <div className="md:hidden bg-[#1A2B4A] px-4 py-4 flex flex-col gap-1">
          {CANAIS.map((canal) => (
            <Link
              key={canal.label}
              href={canal.href}
              onClick={() => setMenuOpen(false)}
              className="text-gray-200 text-sm font-medium py-2 border-b border-[#2a3d5e] last:border-0 hover:text-[#C9A84C] transition-colors"
            >
              {canal.label}
            </Link>
          ))}
          <div className="pt-3 flex gap-3">
            <Link href="/assinatura" onClick={() => setMenuOpen(false)} className="bg-[#C9A84C] text-white text-sm font-bold px-4 py-2 rounded">
              Assinar
            </Link>
            <Link href="/login" onClick={() => setMenuOpen(false)} className="text-gray-200 text-sm font-medium py-2">
              Entrar
            </Link>
          </div>
        </div>
      )}

    </header>
  );
}