import { NextRequest, NextResponse } from "next/server";
import { payment, CLASSIFIED_FEATURED_PRICE } from "@/lib/mercadopago";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const { classified_id } = await req.json() as { classified_id: number };

  const { data: classified } = await supabase.from("classifieds").select("id, status, user_id")
    .eq("id", classified_id).eq("user_id", user.id).single();
  if (!classified) return NextResponse.json({ error: "Nao encontrado" }, { status: 404 });

  const result = await payment.create({
    body: {
      transaction_amount: CLASSIFIED_FEATURED_PRICE,
      description: "Destaque de classificado - 30 dias",
      payment_method_id: "pix",
      external_reference: String(classified_id),
      payer: { email: user.email! },
    },
  });

  return NextResponse.json({
    payment_id: result.id,
    qr_code: result.point_of_interaction?.transaction_data?.qr_code,
    qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64,
  });
}
