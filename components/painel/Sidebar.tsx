"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { secoesDisponiveis, SECOES_META, type Role } from "@/lib/painel/permissions";

export default function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const secoes = secoesDisponiveis(role);

  return (
    <aside className="w-60 shrink-0 bg-[#1A2B4A] text-white min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <span className="font-bold text-lg">Portal</span>
        <span className="text-[#C9A84C] font-bold text-lg"> MetalMecânica</span>
        <p className="text-xs text-white/50 mt-0.5">Painel de Gestão</p>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {secoes.map((secao) => {
          const meta = SECOES_META[secao];
          const Icone = meta.icone;
          const ativo =
            secao === "dashboard"
              ? pathname === "/painel"
              : pathname === meta.rota || pathname.startsWith(meta.rota + "/");
          return (
            <Link
              key={secao}
              href={meta.rota}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                ativo
                  ? "bg-[#C9A84C] text-[#1A2B4A] font-semibold"
                  : "text-white/80 hover:bg-white/10"
              }`}
            >
              <Icone className="w-4 h-4 shrink-0" />
              {meta.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
