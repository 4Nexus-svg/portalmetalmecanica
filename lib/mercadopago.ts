import { MercadoPagoConfig, Payment } from "mercadopago";

export const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN!,
});

export const payment = new Payment(mpClient);
export const CLASSIFIED_FEATURED_PRICE = 150;
