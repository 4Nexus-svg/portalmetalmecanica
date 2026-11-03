import { createPublicClient } from "@/lib/supabase/public";
import type { Database } from '@/types/database';

type Snapshot = Database['public']['Tables']['indicadores_snapshots']['Row'];
type Config = Database['public']['Tables']['indicadores_config']['Row'];

export type IndicadorComConfig = Config & {
  latest: Snapshot | null;
  sparkline: number[];
};

// Todos os indicadores ativos com ultimo snapshot e sparkline (30 pontos)
export async function getIndicadoresComDados(): Promise<IndicadorComConfig[]> {
  const supabase = createPublicClient();

  const { data: rawConfigs } = (await supabase
    .from('indicadores_config')
    .select('*')
    .eq('active', true)
    .order('group_name')
    .order('slug')) as unknown as { data: Config[] | null };

  const configs = rawConfigs ?? [];
  if (!configs.length) return [];

  const slugs = configs.map((c) => c.slug);

  const { data: rawRows } = (await supabase
    .from('indicadores_snapshots')
    .select('*')
    .in('slug', slugs)
    .order('captured_at', { ascending: false })
    .limit(slugs.length * 30)) as unknown as { data: Snapshot[] | null };

  const latestMap = new Map<string, Snapshot>();
  const sparklineMap = new Map<string, number[]>();

  for (const row of rawRows ?? []) {
    if (!latestMap.has(row.slug)) {
      latestMap.set(row.slug, row);
    }
    const arr = sparklineMap.get(row.slug) ?? [];
    if (arr.length < 30) {
      arr.push(row.value);
      sparklineMap.set(row.slug, arr);
    }
  }

  return configs.map((config) => ({
    ...config,
    latest: latestMap.get(config.slug) ?? null,
    sparkline: (sparklineMap.get(config.slug) ?? []).reverse(),
  }));
}

// Historico de um indicador para a pagina de detalhe
export async function getHistorico(slug: string, dias: number): Promise<Snapshot[]> {
  const supabase = createPublicClient();
  const since = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

  const { data } = (await supabase
    .from('indicadores_snapshots')
    .select('*')
    .eq('slug', slug)
    .gte('captured_at', since)
    .order('captured_at', { ascending: true })) as unknown as { data: Snapshot[] | null };

  return data ?? [];
}

// Config + ultimo snapshot de um slug especifico
export async function getIndicadorBySlug(
  slug: string
): Promise<{ config: Config; latest: Snapshot | null } | null> {
  const supabase = createPublicClient();

  const { data: config } = (await supabase
    .from('indicadores_config')
    .select('*')
    .eq('slug', slug)
    .single()) as unknown as { data: Config | null };

  if (!config) return null;

  const { data: latest } = (await supabase
    .from('indicadores_snapshots')
    .select('*')
    .eq('slug', slug)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle()) as unknown as { data: Snapshot | null };

  return { config, latest: latest ?? null };
}

// Ultimas capturas de cada indicador dos cards do resumo (mais recente primeiro).
// raw_data so dos mensais (traz o periodo de referencia); o dos diarios e o
// payload inteiro do Yahoo, pesado e desnecessario aqui.
export async function getHistoricosCards(
  slugs: string[],
  slugsMensais: string[]
): Promise<Record<string, { value: number; variation: number | null; captured_at: string; raw_data?: Record<string, unknown> | null }[]>> {
  const supabase = createPublicClient();
  const pares = await Promise.all(
    slugs.map(async (slug) => {
      const colunas = slugsMensais.includes(slug)
        ? 'value, variation, captured_at, raw_data'
        : 'value, variation, captured_at';
      const { data } = (await supabase
        .from('indicadores_snapshots')
        .select(colunas)
        .eq('slug', slug)
        .order('captured_at', { ascending: false })
        .limit(16)) as unknown as {
        data: { value: number; variation: number | null; captured_at: string; raw_data?: Record<string, unknown> | null }[] | null;
      };
      return [slug, data ?? []] as const;
    })
  );
  return Object.fromEntries(pares);
}
