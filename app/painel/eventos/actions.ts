"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";
import { slugifyTitulo } from "@/lib/noticias/utils";

export type EventoTipo = "feira" | "congresso" | "seminario" | "workshop" | "treinamento";

export interface EventoInput {
  title: string;
  slug: string;
  description: string | null;
  type: EventoTipo;
  date_start: string;
  date_end: string | null;
  city: string | null;
  state: string | null;
  organizer: string | null;
  image_url: string | null;
}

export async function criarEvento(input: EventoInput) {
  await exigirSecao("eventos");
  const supabase = await createServiceClient();
  const slug = input.slug || slugifyTitulo(input.title);
  const { error } = await (supabase.from("events") as any).insert({ ...input, slug, is_auto: false });
  if (error) throw new Error(error.message);
  revalidatePath("/painel/eventos");
  revalidatePath("/eventos");
}

export async function atualizarEvento(id: number, input: EventoInput) {
  await exigirSecao("eventos");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("events") as any).update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/eventos");
  revalidatePath("/eventos");
}

export async function excluirEvento(id: number) {
  await exigirSecao("eventos");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/eventos");
  revalidatePath("/eventos");
}
