import { redirect } from "next/navigation";
import { getPainelUser } from "@/lib/painel/auth";
import { podeAcessar } from "@/lib/painel/permissions";
import { getSettings } from "@/lib/settings";
import SecaoHeader from "@/components/painel/SecaoHeader";
import ConfiguracoesClient from "./ConfiguracoesClient";

export default async function ConfiguracoesPage() {
  const u = await getPainelUser();
  if (!u) redirect("/");
  if (!podeAcessar(u.role, "configuracoes")) redirect("/painel");

  const settings = await getSettings();

  return (
    <div>
      <SecaoHeader titulo="Configurações" descricao="Configurações gerais do portal." />
      <ConfiguracoesClient inicial={settings} />
    </div>
  );
}
