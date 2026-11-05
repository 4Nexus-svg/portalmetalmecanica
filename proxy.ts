import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { CookieOptions } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as CookieOptions)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/assinante") || pathname.startsWith("/classificados/novo")) {
    if (!user) return NextResponse.redirect(new URL("/login?next=" + pathname, request.url));
  }

  // A verificação de role (admin / painel) já é feita pelas próprias páginas
  // (app/admin/page.tsx, app/painel/layout.tsx), que buscam o profile completo
  // mesmo. Repetir a consulta aqui só duplicava 2 round-trips ao Supabase em
  // toda navegação — checar apenas a sessão já basta como gate rápido.
  if (pathname.startsWith("/admin") || pathname.startsWith("/painel")) {
    if (!user) return NextResponse.redirect(new URL("/login?next=" + pathname, request.url));
  }

  if (pathname.startsWith("/assinante")) {
    const now = new Date().toISOString();
    const { data: subscription } = await supabase
      .from("subscriptions").select("status").eq("user_id", user!.id)
      .eq("status", "active").gte("current_period_end", now).maybeSingle();
    if (!subscription) return NextResponse.redirect(new URL("/assinatura?paywall=1", request.url));
  }

  return supabaseResponse;
}

// Só roda nas rotas que realmente precisam de sessão. Antes rodava em TODA
// requisição (inclusive páginas públicas em cache ISR e bots), chamando o
// Supabase Auth a cada hit e estourando o Fluid Active CPU do plano Hobby.
export const config = {
  matcher: [
    "/assinante/:path*",
    "/classificados/novo/:path*",
    "/admin/:path*",
    "/painel/:path*",
    "/api/assinatura/:path*",
    "/api/classificados/:path*",
    "/api/noticias/:path*",
  ],
};