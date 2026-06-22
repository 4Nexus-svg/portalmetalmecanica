"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";
import { slugifyTitulo } from "@/lib/noticias/utils";

export interface ColunistaInput {
  nome: string;
  slug: string;
  cargo: string | null;
  especialidade: string | null;
  bio: string | null;
  foto_url: string | null;
  ativo: boolean;
  profile_id: string | null;
}

export interface ArtigoInput {
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  cover_url: string | null;
  columnist_id: number;
  publicar: boolean;
}

/** Retorna o columnists.id vinculado ao usuário (profile_id), ou null. */
export async function columnistIdDoUsuario(userId: string): Promise<number | null> {
  const supabase = await createServiceClient();
  const { data } = await (supabase.from("columnists") as any)
    .select("id").eq("profile_id", userId).maybeSingle();
  return data?.id ?? null;
}

// ---- Colunistas (somente admin/editor) ----

export async function criarColunista(input: ColunistaInput) {
  const { role } = await exigirSecao("colunistas");
  if (role !== "admin" && role !== "editor") throw new Error("Não autorizado");
  const supabase = await createServiceClient();
  const slug = input.slug || slugifyTitulo(input.nome);
  const { error } = await (supabase.from("columnists") as any).insert({ ...input, slug });
  if (error) throw new Error(error.message);
  revalidatePath("/painel/colunistas");
  revalidatePath("/colunistas");
}

export async function atualizarColunista(id: number, input: ColunistaInput) {
  const { role } = await exigirSecao("colunistas");
  if (role !== "admin" && role !== "editor") throw new Error("Não autorizado");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("columnists") as any).update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/colunistas");
  revalidatePath("/colunistas");
}

export async function excluirColunista(id: number) {
  const { role } = await exigirSecao("colunistas");
  if (role !== "admin" && role !== "editor") throw new Error("Não autorizado");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("columnists").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/colunistas");
  revalidatePath("/colunistas");
}

// ---- Artigos (admin/editor: qualquer; colunista: só os próprios) ----

async function validarPosseArtigo(columnistId: number) {
  const { userId, role } = await exigirSecao("colunistas");
  if (role === "admin" || role === "editor") return;
  const meu = await columnistIdDoUsuario(userId);
  if (meu !== columnistId) throw new Error("Não autorizado a este artigo");
}

export async function criarArtigo(input: ArtigoInput) {
  await validarPosseArtigo(input.columnist_id);
  const supabase = await createServiceClient();
  const slug = input.slug || slugifyTitulo(input.title);
  const { error } = await (supabase.from("articles") as any).insert({
    title: input.title, slug, excerpt: input.excerpt, content: input.content,
    cover_url: input.cover_url, columnist_id: input.columnist_id,
    published_at: input.publicar ? new Date().toISOString() : null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/painel/colunistas");
  revalidatePath("/colunistas", "layout");
  revalidatePath("/artigos/" + slug);
}

export async function atualizarArtigo(id: number, input: ArtigoInput) {
  await validarPosseArtigo(input.columnist_id);
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("articles") as any).update({
    title: input.title, slug: input.slug, excerpt: input.excerpt, content: input.content,
    cover_url: input.cover_url, columnist_id: input.columnist_id,
    published_at: input.publicar ? new Date().toISOString() : null,
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/colunistas");
  revalidatePath("/colunistas", "layout");
  revalidatePath("/artigos/" + input.slug);
}

export async function excluirArtigo(id: number, columnistId: number) {
  await validarPosseArtigo(columnistId);
  const supabase = await createServiceClient();
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/colunistas");
}
