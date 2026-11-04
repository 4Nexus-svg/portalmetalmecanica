import { createPublicClient } from "@/lib/supabase/public";
import { BannerRotativo } from "./BannerRotativo";
import type { Database } from "@/types/database";

type AdRow = Database["public"]["Tables"]["ads"]["Row"];
type Position = "top" | "top_mobile" | "sidebar" | "between" | "footer";

interface Props {
  position: Position;
  /** Posição alternativa usada quando não há anúncios na principal */
  fallbackPosition?: Position;
  className?: string;
}

export async function BannerSlot({ position, fallbackPosition, className }: Props) {
  const supabase = createPublicClient();
  const hoje = new Date().toISOString().split("T")[0];

  async function buscar(pos: Position) {
    const { data } = await supabase
      .from("ads")
      .select("id, image_url, link, name, ordem, duracao")
      .eq("position", pos)
      .or(`start_date.is.null,start_date.lte.${hoje}`)
      .or(`end_date.is.null,end_date.gte.${hoje}`)
      .order("ordem", { ascending: true })
      .limit(10) as unknown as { data: Pick<AdRow, "id" | "image_url" | "link" | "name" | "ordem" | "duracao">[] | null; error: unknown };
    return data;
  }

  let data = await buscar(position);
  if (!data?.length && fallbackPosition) data = await buscar(fallbackPosition);

  if (!data?.length) return null;

  return <BannerRotativo ads={data} className={className} />;
}
