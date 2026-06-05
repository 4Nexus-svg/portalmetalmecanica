"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";

export interface DestaqueInput {
  name: string;
  logo_url: string | null;
  link: string | null;
  description: string | null;
  ordem: number;
  ativo: boolean;
  start_date: string | null;
  end_date: string | null;
}

export async function criarDestaque(input: DestaqueInput) {
  await exigirSecao("destaques");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("featured_companies") as any).insert(input);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/destaques");
  revalidatePath("/");
}

export async function atualizarDestaque(id: number, input: DestaqueInput) {
  await exigirSecao("destaques");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("featured_companies") as any).update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/destaques");
  revalidatePath("/");
}

export async function excluirDestaque(id: number) {
  await exigirSecao("destaques");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("featured_companies").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/destaques");
  revalidatePath("/");
}
