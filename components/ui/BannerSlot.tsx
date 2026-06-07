import { createClient } from "@/lib/supabase/server";
import { BannerRotativo } from "./BannerRotativo";
import type { Database } from "@/types/database";

type AdRow = Database["public"]["Tables"]["ads"]["Row"];
type Position = "top" | "sidebar" | "between" | "footer";

interface Props {
  position: Position;
  className?: string;
}

export async function BannerSlot({ position, className }: Props) {
  const supabase = await createClient();
  const hoje = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("ads")
    .select("id, image_url, link, name, ordem, duracao")
    .eq("position", position)
    .or(`start_date.is.null,start_date.lte.${hoje}`)
    .or(`end_date.is.null,end_date.gte.${hoje}`)
    .order("ordem", { ascending: true })
    .limit(10) as unknown as { data: Pick<AdRow, "id" | "image_url" | "link" | "name" | "ordem" | "duracao">[] | null; error: unknown };

  if (!data?.length) return null;

  return <BannerRotativo ads={data} className={className} />;
}
