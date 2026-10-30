import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cliente Supabase para páginas e componentes PÚBLICOS: chave anon, sem
 * cookies nem sessão. Não ler cookies é o que permite o Next cachear as
 * páginas (ISR via `revalidate`) — o cliente com cookies (lib/supabase/server)
 * força renderização a cada visita e cada visita vira consulta ao banco
 * (estourou a cota de egress do Supabase em out/2026).
 *
 * Use o cliente com cookies só onde a sessão importa (painel, assinante,
 * conteúdo exclusivo).
 */
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
