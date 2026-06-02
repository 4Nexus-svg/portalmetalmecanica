import { NextRequest, NextResponse } from "next/server";
import { payment } from "@/lib/mercadopago";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.type !== "payment") return NextResponse.json({ received: true });

  const paymentId = body.data?.id;
  if (!paymentId) return NextResponse.json({ error: "Missing ID" }, { status: 400 });

  const paymentData = await payment.get({ id: paymentId });
  if (paymentData.status !== "approved") return NextResponse.json({ received: true });

  const classifiedId = paymentData.external_reference;
  if (!classifiedId) return NextResponse.json({ received: true });

  const supabase = await createServiceClient();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  await supabase.from("classifieds").update({
    status: "active",
    expires_at: expiresAt.toISOString(),
    payment_intent_id: String(paymentId),
  }).eq("id", Number(classifiedId));

  return NextResponse.json({ received: true });
}
