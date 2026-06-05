"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABEL, type Role } from "@/lib/painel/permissions";

export default function PainelHeader({
  nome,
  role,
}: {
  nome: string;
  role: Role;
}) {
  const router = useRouter();

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-10">
      <div>
        <p className="text-sm font-semibold text-[#1A2B4A]">{nome}</p>
        <p className="text-xs text-gray-400">{ROLE_LABEL[role]}</p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1A2B4A] transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Ver site
        </Link>
        <button
          onClick={sair}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </header>
  );
}
