import { getSettings } from "@/lib/settings";
import AssinaturaClient from "./AssinaturaClient";

export default async function AssinaturaPage() {
  const s = await getSettings();
  return <AssinaturaClient precoMensal={s.subscription_price || "290"} />;
}
