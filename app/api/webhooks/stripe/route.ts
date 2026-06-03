import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/server";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const subscriptionId = session.subscription as string;
    const userId = session.metadata?.user_id;
    if (!userId || !subscriptionId) return NextResponse.json({ received: true });

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const plan = subscription.items.data[0]?.price.id === process.env.STRIPE_PRICE_ID_YEARLY ? "yearly" : "monthly";

    await (supabase.from("subscriptions") as any).upsert({
      id: subscriptionId, user_id: userId,
      status: subscription.status as "active" | "trialing",
      plan,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    });
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const plan = subscription.items.data[0]?.price.id === process.env.STRIPE_PRICE_ID_YEARLY ? "yearly" : "monthly";

    await (supabase.from("subscriptions") as any).update({
      status: subscription.status as "active" | "canceled" | "past_due",
      plan,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    }).eq("id", subscription.id);
  }

  return NextResponse.json({ received: true });
}
