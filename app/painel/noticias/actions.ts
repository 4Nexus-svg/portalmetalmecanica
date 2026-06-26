"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";

export interface PostInput {
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  featured_image: string | null;
  category: string | null;
  region: string | null;
  published_at: string | null;
  is_exclusive: boolean;
}

export async function criarPost(input: PostInput) {
  await exigirSecao("noticias");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("posts") as any).insert({
    ...input,
    is_auto: false,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/painel/noticias");
  revalidatePath("/noticias");
  revalidatePath("/");
}

export async function atualizarPost(id: number, input: PostInput) {
  await exigirSecao("noticias");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("posts") as any).update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/noticias");
  revalidatePath("/noticias");
  revalidatePath("/");
}

export async function excluirPost(id: number) {
  await exigirSecao("noticias");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/noticias");
  revalidatePath("/noticias");
  revalidatePath("/");
}
