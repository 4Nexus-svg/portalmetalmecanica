# Portal Metalmecanica

Stack: Next.js 14 + Supabase + Stripe + Mercado Pago + Vercel

## Setup rapido

1. Clone o repositorio e acesse a pasta
2. Copie `.env.local.example` para `.env.local` e preencha as variaveis
3. Execute `supabase/migrations/001_schema.sql` no SQL Editor do Supabase
4. Instale as dependencias: `npm install`
5. Rode em desenvolvimento: `npm run dev`

## Estrutura de pastas

| Pasta | Funcao |
|---|---|
| `app/(public)/` | Home, noticias, classificados, assinatura |
| `app/admin/` | Painel admin (role='admin') |
| `app/assinante/dashboard/` | Area restrita ao assinante |
| `app/api/` | Webhooks, checkout, newsletter |
| `lib/` | Clientes Supabase, Stripe, Mercado Pago |
| `types/database.ts` | Tipos TypeScript das tabelas |
| `supabase/migrations/` | Schema SQL completo |

## Webhooks

| Gateway | Endpoint |
|---|---|
| Stripe | `POST /api/webhooks/stripe` |
| Mercado Pago | `POST /api/webhooks/mercadopago` |
