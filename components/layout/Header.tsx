"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import SearchBar from "@/components/ui/SearchBar";
import NavEditorias from "./NavEditorias";

export default function Header() {
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

          {/* Esquerda: busca (apenas desktop — no mobile a lupa fica na barra de editorias) */}
          <div className="w-32">
            <div className="hidden md:block">
              <SearchBar />
            </div>
          </div>

          {/* Centro: logo + slogan */}
          <Link href="/" className="flex flex-col items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="Portal Metalmecânica"
              className={`w-auto object-contain transition-all duration-300 ${scrolled ? "h-10" : "h-20"}`}
            />
            <span className={`text-[10px] sm:text-xs font-medium tracking-[0.25em] text-[#1A2B4A]/70 uppercase whitespace-nowrap mt-1.5 transition-all duration-300 ${scrolled ? "opacity-0 h-0 overflow-hidden mt-0" : "opacity-100"}`}>
              Notícias <span className="text-[#C9A84C] mx-0.5">|</span> Negócios <span className="text-[#C9A84C] mx-0.5">|</span> Inovação <span className="text-[#C9A84C] mx-0.5">|</span> Indústria
            </span>
          </Link>

          {/* Direita: entrar + assinar (o hambúrguer foi para a barra de editorias) */}
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
          </div>

        </div>
      </div>

      {/* Linha dourada */}
      <div className="h-1 bg-gradient-to-r from-[#C9A84C] via-[#e8c97a] to-[#C9A84C]" />

      {/* Navegação responsiva (mobile: hambúrguer/Editorias/lupa · desktop: pílulas) */}
      <NavEditorias />

    </header>
  );
}
