"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import SearchBar from "@/components/ui/SearchBar";

type Editorial = { label: string; href: string };

/**
 * Lista flat de editorias/canais. Usada tanto nas pílulas do desktop quanto
 * no painel do mobile (padrão flat, sem submenus aninhados).
 */
const EDITORIAS: Editorial[] = [
  { label: "Todas as Notícias", href: "/noticias" },
  { label: "Espírito Santo", href: "/noticias/es" },
  { label: "Minas Gerais", href: "/noticias/mg" },
  { label: "Brasil Industrial", href: "/noticias/brasil" },
  { label: "Economia", href: "/noticias/economia" },
  { label: "Tecnologia", href: "/noticias/tecnologia" },
  { label: "Sustentabilidade", href: "/noticias/sustentabilidade" },
  { label: "Segurança do Trabalho", href: "/noticias/seguranca" },
  { label: "Mercado", href: "/mercado" },
  { label: "Indicadores", href: "/indicadores" },
  { label: "Opinião", href: "/opiniao" },
  { label: "Eventos", href: "/eventos" },
  { label: "Mídia", href: "/midia" },
];

const PANEL_ID = "menu-editorias";

export default function NavEditorias() {
  const pathname = usePathname();
  const [pathAnterior, setPathAnterior] = useState(pathname);
  const [menuAberto, setMenuAberto] = useState(false);

  // Fecha o menu quando a rota muda — ajuste durante o render (sem useEffect),
  // padrão "storing information from previous renders" do React.
  if (pathAnterior !== pathname) {
    setPathAnterior(pathname);
    setMenuAberto(false);
  }

  const ativo = (href: string) => pathname === href;

  return (
    <nav aria-label="Editorias">
      {/* ── Mobile: hambúrguer + rótulo + lupa (uma linha de altura fixa) ── */}
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

        {/* Painel de editorias (render condicional) */}
        {menuAberto && (
          <ul
            id={PANEL_ID}
            className="rounded-xl px-3 py-3 flex flex-col gap-0.5 border-t border-gray-100"
          >
            {EDITORIAS.map((ed) => (
              <li key={ed.href}>
                <Link
                  href={ed.href}
                  onClick={() => setMenuAberto(false)}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    ativo(ed.href)
                      ? "bg-[#C9A84C]/15 text-[#8a6d1f] font-semibold"
                      : "text-gray-600 hover:bg-[#1A2B4A] hover:text-white"
                  }`}
                >
                  {ed.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Desktop: pílulas com rolagem horizontal (scrollbar escondida) ── */}
      <div className="hidden md:block bg-[#1A2B4A]">
        <div className="max-w-7xl mx-auto px-2">
          <ul className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
            {EDITORIAS.map((ed) => (
              <li key={ed.href}>
                <Link
                  href={ed.href}
                  className={`block whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors ${
                    ativo(ed.href)
                      ? "text-[#C9A84C] bg-[#0f1e35]"
                      : "text-gray-200 hover:text-[#C9A84C] hover:bg-[#0f1e35]"
                  }`}
                >
                  {ed.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}
