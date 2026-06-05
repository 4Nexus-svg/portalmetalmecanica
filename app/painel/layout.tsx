import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rolePainel } from "@/lib/painel/permissions";
import Sidebar from "@/components/painel/Sidebar";
import PainelHeader from "@/components/painel/PainelHeader";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar role={role} />
      <div className="flex-1 flex flex-col min-w-0">
        <PainelHeader nome={nome} role={role} />
        <main className="flex-1 px-6 py-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
