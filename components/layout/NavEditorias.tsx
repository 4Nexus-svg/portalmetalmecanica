"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";
import SearchBar from "@/components/ui/SearchBar";

type Item = { label: string; href: string };
type Canal = { label: string; href: string; submenu: Item[] };

/**
 * Menu principal do portal — 5 canais, cada um com submenu.
 * Mantém a barra responsiva (mobile: hambúrguer/Editorias/lupa ·
 * desktop: pílulas) e a estrutura original de submenus:
 * hover/foco no desktop, acordeão no mobile.
 */
const CANAIS: Canal[] = [
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
    ],
  },
  {
    label: "Mercado",
    href: "/mercado",
    submenu: [
      { label: "Licitações", href: "/mercado/licitacoes" },
      { label: "Exportação & Importação", href: "/mercado/exportacao-importacao" },
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
      { label: "Exportações ES", href: "/indicadores/exportacoes_es" },
      { label: "Exportações MG", href: "/indicadores/exportacoes_mg" },
      { label: "Produção Industrial ES", href: "/indicadores/producao_es" },
      { label: "Produção Industrial MG", href: "/indicadores/producao_mg" },
    ],
  },
  {
    label: "Opiniões",
    href: "/opiniao",
    submenu: [{ label: "Colunistas", href: "/colunistas" }],
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
];

const PANEL_ID = "menu-editorias";

/** id válido para aria-controls (desktop e mobile não colidem). */
const idSubmenu = (prefixo: string, href: string) =>
  `${prefixo}-${href.slice(1).replace(/\//g, "-") || "raiz"}`;

export default function NavEditorias() {
  const pathname = usePathname();
  const [pathAnterior, setPathAnterior] = useState(pathname);
  const [menuAberto, setMenuAberto] = useState(false);
  const [submenuAberto, setSubmenuAberto] = useState<string | null>(null);

  // Fecha o menu quando a rota muda — ajuste durante o render (sem useEffect),
  // padrão "storing information from previous renders" do React.
  if (pathAnterior !== pathname) {
    setPathAnterior(pathname);
    setMenuAberto(false);
    setSubmenuAberto(null);
  }

  // Ativo na própria rota ou em uma rota filho
  const ativo = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const fecharTudo = () => {
    setMenuAberto(false);
    setSubmenuAberto(null);
  };

  return (
    <nav aria-label="Editorias">
      {/* ── Mobile: hambúrguer + rótulo + lupa ── */}
      <div className="md:hidden bg-white border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 h-12">
          <button
            type="button"
            onClick={() => setMenuAberto((v) => !v)}
            aria-expanded={menuAberto}
            aria-controls={PANEL_ID}
            aria-label={menuAberto ? "Fechar menu de editorias" : "Abrir menu de editorias"}
            className="p-1.5 -ml-1.5 text-[#1A2B4A] hover:text-[#C9A84C] transition-colors"
          >
            {menuAberto ? <X size={22} /> : <Menu size={22} />}
          </button>

          <span className="text-sm font-semibold uppercase tracking-widest text-[#1A2B4A]">
            Editorias
          </span>

          <div className="ml-auto">
            <SearchBar />
          </div>
        </div>

        {/* Painel com acordeão de submenus (render condicional) */}
        {menuAberto && (
          <ul
            id={PANEL_ID}
            className="rounded-xl px-3 py-3 flex flex-col gap-0.5 border-t border-gray-100"
          >
            {CANAIS.map((canal) => {
              const aberto = submenuAberto === canal.label;
              const canalAtivo =
                ativo(canal.href) || canal.submenu.some((s) => ativo(s.href));
              return (
                <li key={canal.label}>
                  <div className="flex items-center gap-1">
                    <Link
                      href={canal.href}
                      onClick={fecharTudo}
                      aria-current={canalAtivo ? "page" : undefined}
                      className={`flex-1 block rounded-lg px-3 py-2 text-sm transition-colors ${
                        canalAtivo
                          ? "bg-[#C9A84C]/15 text-[#8a6d1f] font-semibold"
                          : "text-gray-600 hover:bg-[#1A2B4A] hover:text-white"
                      }`}
                    >
                      {canal.label}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setSubmenuAberto(aberto ? null : canal.label)}
                      aria-expanded={aberto}
                      aria-controls={idSubmenu("submenu-mobile", canal.href)}
                      aria-label={`${aberto ? "Recolher" : "Expandir"} ${canal.label}`}
                      className="p-2 text-gray-400 hover:text-[#C9A84C] transition-colors"
                    >
                      <ChevronDown
                        size={15}
                        className={`transition-transform duration-200 ${aberto ? "rotate-180" : ""}`}
                      />
                    </button>
                  </div>

                  {aberto && (
                    <ul
                      id={idSubmenu("submenu-mobile", canal.href)}
                      className="mt-0.5 mb-1 ml-5 flex flex-col gap-0.5 pl-3 border-l border-gray-200"
                    >
                      {canal.submenu.map((item) => (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={fecharTudo}
                            aria-current={ativo(item.href) ? "page" : undefined}
                            className={`block rounded-lg px-3 py-1.5 text-sm transition-colors ${
                              ativo(item.href)
                                ? "bg-[#C9A84C]/15 text-[#8a6d1f] font-semibold"
                                : "text-gray-500 hover:bg-[#1A2B4A] hover:text-white"
                            }`}
                          >
                            {item.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Desktop: pílulas dos canais, submenu no hover/foco ── */}
      <div className="hidden md:block bg-[#1A2B4A]">
        <div className="max-w-7xl mx-auto px-2">
          <ul className="flex items-center justify-center">
            {CANAIS.map((canal) => {
              const aberto = submenuAberto === canal.label;
              const canalAtivo =
                ativo(canal.href) || canal.submenu.some((s) => ativo(s.href));
              return (
                <li
                  key={canal.label}
                  className="relative"
                  onMouseEnter={() => setSubmenuAberto(canal.label)}
                  onMouseLeave={() => setSubmenuAberto(null)}
                  onFocus={() => setSubmenuAberto(canal.label)}
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                      setSubmenuAberto(null);
                    }
                  }}
                >
                  <Link
                    href={canal.href}
                    aria-haspopup="true"
                    aria-expanded={aberto}
                    aria-controls={idSubmenu("submenu-desktop", canal.href)}
                    className={`flex items-center gap-1 whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors ${
                      canalAtivo
                        ? "text-[#C9A84C] bg-[#0f1e35]"
                        : "text-gray-200 hover:text-[#C9A84C] hover:bg-[#0f1e35]"
                    }`}
                  >
                    {canal.label}
                    <ChevronDown
                      size={13}
                      className={`opacity-60 transition-transform duration-200 ${aberto ? "rotate-180" : ""}`}
                    />
                  </Link>

                  {aberto && (
                    <div
                      id={idSubmenu("submenu-desktop", canal.href)}
                      className="absolute top-full left-0 bg-white border border-gray-100 shadow-xl rounded-b-lg min-w-48 z-50"
                    >
                      {canal.submenu.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={ativo(item.href) ? "page" : undefined}
                          className={`block px-4 py-2.5 text-sm border-b border-gray-50 last:border-0 transition-colors ${
                            ativo(item.href)
                              ? "bg-[#C9A84C]/15 text-[#8a6d1f] font-semibold"
                              : "text-gray-700 hover:bg-[#1A2B4A] hover:text-white"
                          }`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}
