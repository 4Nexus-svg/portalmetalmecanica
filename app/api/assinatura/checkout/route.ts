import { NextRequest, NextResponse } from "next/server";
import { stripe, PLANS } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });

  const { plan } = await req.json() as { plan: "monthly" | "yearly" };
  const planConfig = PLANS[plan];
  if (!planConfig) return NextResponse.json({ error: "Plano invalido" }, { status: 400 });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: planConfig.priceId, quantity: 1 }],
    customer_email: user.email,
    metadata: { user_id: user.id },
    success_url: process.env.NEXT_PUBLIC_APP_URL + "/assinante/dashboard?success=1",
    cancel_url: process.env.NEXT_PUBLIC_APP_URL + "/assinatura?canceled=1",
    locale: "pt-BR",
  });

  return NextResponse.json({ url: session.url });
}
