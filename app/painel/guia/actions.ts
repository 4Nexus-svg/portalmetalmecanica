"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";

export interface CompanyInput {
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  site: string | null;
  logo_url: string | null;
  description: string | null;
  ativo: boolean;
}

export async function criarEmpresa(input: CompanyInput) {
  await exigirSecao("guia");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("companies") as any).insert(input);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/guia");
  revalidatePath("/guia");
}

export async function atualizarEmpresa(id: number, input: CompanyInput) {
  await exigirSecao("guia");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("companies") as any).update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/guia");
  revalidatePath("/guia");
}

export async function excluirEmpresa(id: number) {
  await exigirSecao("guia");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("companies").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/guia");
  revalidatePath("/guia");
}
