import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rolePainel, secoesDisponiveis, SECOES_META } from "@/lib/painel/permissions";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function PainelDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/painel");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle() as { data: Profile | null; error: unknown };

  const role = rolePainel(profile?.role);
  if (!role) redirect("/");

  const nome = profile?.name ?? user.email ?? "Usuário";
  const atalhos = secoesDisponiveis(role).filter((s) => s !== "dashboard");

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1A2B4A]">Bem-vindo, {nome}</h1>
      <p className="text-sm text-gray-500 mt-1">Selecione uma área para gerenciar.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
        {atalhos.map((secao) => {
          const meta = SECOES_META[secao];
          const Icone = meta.icone;
          return (
            <Link
              key={secao}
              href={meta.rota}
              className="group bg-white rounded-xl border border-gray-100 p-5 hover:border-[#C9A84C] hover:shadow-sm transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-[#1A2B4A]/5 flex items-center justify-center mb-3 group-hover:bg-[#C9A84C]/15 transition-colors">
                <Icone className="w-5 h-5 text-[#1A2B4A]" />
              </div>
              <p className="font-semibold text-[#1A2B4A]">{meta.label}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
