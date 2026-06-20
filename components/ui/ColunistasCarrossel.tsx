"use client";
import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Colunista = {
  nome: string;
  slug: string;
  especialidade: string;
  iniciais: string;
  cor: string;
  foto_url?: string | null;
};

export default function ColunistasCarrossel({ colunistas }: { colunistas: Colunista[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: "prev" | "next") {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "next" ? 320 : -320, behavior: "smooth" });
  }

  return (
    <section className="bg-white border-y border-gray-100 py-5">
      <div className="max-w-7xl mx-auto px-4">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 bg-[#C9A84C] rounded" />
            <h2 className="text-sm font-bold text-[#1A2B4A] uppercase tracking-wider">Colunistas</h2>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/colunistas" className="text-xs text-[#C9A84C] font-medium hover:underline mr-2">
              Ver todos
            </Link>
            <button
              onClick={() => scroll("prev")}
              className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-[#1A2B4A] hover:border-[#1A2B4A] hover:text-white transition-colors text-gray-500"
              aria-label="Anteriores"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              onClick={() => scroll("next")}
              className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center hover:bg-[#1A2B4A] hover:border-[#1A2B4A] hover:text-white transition-colors text-gray-500"
              aria-label="Próximos"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Carrossel */}
        <div
          ref={scrollRef}
          className="flex gap-px overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {colunistas.map((col, i) => (
            <Link
              key={col.slug}
              href={`/colunistas/${col.slug}`}
              className="group flex-shrink-0 flex flex-col items-center text-center px-5 py-3 hover:bg-gray-50 rounded-xl transition-colors min-w-[130px]"
            >
              {/* Avatar circular */}
              {col.foto_url
                ? <img src={col.foto_url} alt={col.nome} className="w-14 h-14 rounded-full object-cover mb-2 ring-2 ring-transparent group-hover:ring-[#C9A84C] transition-all" />
                : <div className={`w-14 h-14 rounded-full ${col.cor} flex items-center justify-center mb-2 ring-2 ring-transparent group-hover:ring-[#C9A84C] transition-all`}>
                    <span className="text-white font-bold text-sm">{col.iniciais}</span>
                  </div>
              }

              {/* Nome */}
              <p className="text-xs font-bold text-[#1A2B4A] group-hover:text-[#C9A84C] transition-colors leading-tight line-clamp-2">
                {col.nome}
              </p>

              {/* Especialidade */}
              <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2 leading-tight">
                {col.especialidade}
              </p>
            </Link>
          ))}
        </div>

      </div>
    </section>
  );
}
