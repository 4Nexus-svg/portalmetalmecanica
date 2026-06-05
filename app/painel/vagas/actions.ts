"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";

export interface JobInput {
  title: string;
  company: string | null;
  city: string | null;
  state: string | null;
  type: string | null;
  salary: string | null;
  description: string | null;
  link: string | null;
  contact_email: string | null;
  ativo: boolean;
  expires_at: string | null;
}

export async function criarVaga(input: JobInput) {
  await exigirSecao("vagas");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("jobs") as any).insert(input);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/vagas");
  revalidatePath("/vagas");
}

export async function atualizarVaga(id: number, input: JobInput) {
  await exigirSecao("vagas");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("jobs") as any).update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/vagas");
  revalidatePath("/vagas");
}

export async function excluirVaga(id: number) {
  await exigirSecao("vagas");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("jobs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/vagas");
  revalidatePath("/vagas");
}
