"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";

export async function salvarConfiguracoes(valores: Record<string, string>) {
  const { role } = await exigirSecao("configuracoes");
  if (role !== "admin") throw new Error("Não autorizado");
  const supabase = await createServiceClient();
  const linhas = Object.entries(valores).map(([key, value]) => ({ key, value }));
  const { error } = await (supabase.from("site_settings") as any).upsert(linhas, { onConflict: "key" });
  if (error) throw new Error(error.message);
  revalidatePath("/");
  revalidatePath("/assinatura");
  revalidatePath("/painel/configuracoes");
}
