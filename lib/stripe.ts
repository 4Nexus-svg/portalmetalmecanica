import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
  typescript: true,
});

export const PLANS = {
  monthly: {
    priceId: process.env.STRIPE_PRICE_ID_MONTHLY!,
    price: 290,
    label: "Mensal",
  },
  yearly: {
    priceId: process.env.STRIPE_PRICE_ID_YEARLY!,
    price: 2490,
    label: "Anual",
  },
} as const;
