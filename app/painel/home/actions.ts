"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";

export interface BlocoUpdate {
  id: number;
  ordem: number;
  ativo: boolean;
}

export async function salvarLayout(blocos: BlocoUpdate[]) {
  await exigirSecao("home");
  const supabase = await createServiceClient();
  for (const b of blocos) {
    const { error } = await (supabase.from("home_blocks") as any)
      .update({ ordem: b.ordem, ativo: b.ativo }).eq("id", b.id);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/painel/home");
  revalidatePath("/");
}
