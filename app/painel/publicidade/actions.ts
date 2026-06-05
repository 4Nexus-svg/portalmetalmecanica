"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";

export interface AdInput {
  name: string;
  image_url: string | null;
  link: string | null;
  position: "top" | "sidebar" | "between" | "footer";
  start_date: string | null;
  end_date: string | null;
}

export async function criarAd(input: AdInput) {
  await exigirSecao("publicidade");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("ads") as any).insert(input);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/publicidade");
}

export async function atualizarAd(id: number, input: AdInput) {
  await exigirSecao("publicidade");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("ads") as any).update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/publicidade");
}

export async function excluirAd(id: number) {
  await exigirSecao("publicidade");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("ads").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/publicidade");
}
