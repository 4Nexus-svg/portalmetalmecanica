"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getPainelUser, exigirSecao } from "@/lib/painel/auth";

export type PapelDB = "admin" | "editor" | "comercial" | "colunista" | "user";

export async function alterarPapel(userId: string, papel: PapelDB) {
  const { role, userId: meuId } = await exigirSecao("usuarios");
  if (role !== "admin") throw new Error("Não autorizado");
  if (userId === meuId && papel !== "admin") throw new Error("Você não pode rebaixar o próprio usuário.");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("profiles") as any).update({ role: papel }).eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/usuarios");
}

export async function convidarUsuario(email: string) {
  const u = await getPainelUser();
  if (!u || u.role !== "admin") throw new Error("Não autorizado");
  if (!email) throw new Error("Informe um e-mail");
  const supabase = await createServiceClient();
  const { error } = await supabase.auth.admin.inviteUserByEmail(email);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/usuarios");
}
