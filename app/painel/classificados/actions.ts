"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";

export interface ClassificadoInput {
  title: string;
  description: string | null;
  price: number | null;
  category: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  whatsapp: string | null;
  status: "pending" | "active" | "expired" | "paid" | "rejected";
  expires_at: string | null;
}

export async function criarClassificado(input: ClassificadoInput) {
  const { userId } = await exigirSecao("classificados");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("classifieds") as any).insert({ ...input, user_id: userId });
  if (error) throw new Error(error.message);
  revalidatePath("/painel/classificados");
}

export async function atualizarClassificado(id: number, input: ClassificadoInput) {
  await exigirSecao("classificados");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("classifieds") as any).update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/classificados");
}

export async function moderarClassificado(id: number, novoStatus: "active" | "rejected") {
  await exigirSecao("classificados");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("classifieds") as any).update({ status: novoStatus }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/classificados");
}

export async function excluirClassificado(id: number) {
  await exigirSecao("classificados");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("classifieds").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/classificados");
}
