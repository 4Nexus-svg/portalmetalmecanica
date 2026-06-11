"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { exigirSecao } from "@/lib/painel/auth";

export interface LicitacaoInput {
  orgao_cnpj: string;
  orgao_nome: string | null;
  uf: string;
  objeto: string | null;
  modalidade: string | null;
  valor_estimado: number | null;
  data_publicacao: string | null;
  data_encerramento: string | null;
  status: string;
  link_pncp: string | null;
}

function gerarId(): string {
  return `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export async function criarLicitacao(input: LicitacaoInput) {
  await exigirSecao("licitacoes");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("licitacoes_pncp") as any).insert({
    ...input,
    id: gerarId(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/painel/licitacoes");
  revalidatePath("/licitacoes");
}

export async function atualizarLicitacao(id: string, input: LicitacaoInput) {
  await exigirSecao("licitacoes");
  const supabase = await createServiceClient();
  const { error } = await (supabase.from("licitacoes_pncp") as any)
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/licitacoes");
  revalidatePath("/licitacoes");
}

export async function excluirLicitacao(id: string) {
  await exigirSecao("licitacoes");
  const supabase = await createServiceClient();
  const { error } = await supabase.from("licitacoes_pncp").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/painel/licitacoes");
  revalidatePath("/licitacoes");
}
