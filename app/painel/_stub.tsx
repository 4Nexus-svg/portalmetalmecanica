import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rolePainel, podeAcessar, SECOES_META, type Secao } from "@/lib/painel/permissions";
import SecaoHeader from "@/components/painel/SecaoHeader";
import StubSecao from "@/components/painel/StubSecao";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const DESCRICAO: Record<Secao, string> = {
  dashboard:     "Visão geral do painel.",
  publicidade:   "Banners e campanhas publicitárias do portal.",
  classificados: "Anúncios classificados de máquinas, equipamentos e serviços.",
  destaques:     "Empresas em destaque exibidas no portal.",
  guia:          "Guia industrial de empresas e fornecedores.",
  vagas:         "Vagas de emprego do setor metalmecânico.",
  eventos:       "Feiras, congressos e eventos do setor.",
  colunistas:    "Colunistas e seus artigos de opinião.",
  home:          "Montagem e organização da home do portal.",
  configuracoes: "Configurações gerais do portal.",
  usuarios:      "Usuários e papéis de acesso ao painel.",
};

export default async function StubPage({ secao }: { secao: Secao }) {
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
  if (!podeAcessar(role, secao)) redirect("/painel");

  const meta = SECOES_META[secao];
  return (
    <div>
      <SecaoHeader titulo={meta.label} descricao={DESCRICAO[secao]} />
      <StubSecao fase={meta.fase} />
    </div>
  );
}
