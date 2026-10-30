import { createPublicClient } from "@/lib/supabase/public";

export type Settings = Record<string, string>;

const PADROES: Settings = {
  site_name: "Portal MetalMecânica",
  contact_email: "",
  contact_phone: "",
  social_instagram: "",
  social_linkedin: "",
  social_youtube: "",
  subscription_price: "290",
};

export async function getSettings(): Promise<Settings> {
  const supabase = createPublicClient();
  const { data } = await supabase.from("site_settings").select("key, value") as
    { data: { key: string; value: string | null }[] | null; error: unknown };
  const out: Settings = { ...PADROES };
  for (const row of data ?? []) {
    if (row.value != null) out[row.key] = row.value;
  }
  return out;
}
