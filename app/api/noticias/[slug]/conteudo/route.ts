import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sanitizeContent } from '@/lib/sanitize';

/**
 * Corpo de notícia exclusiva, para assinante logado. A página da notícia é
 * cacheada (ISR) e não leva o conteúdo exclusivo no HTML; o navegador do
 * assinante busca aqui com a sessão. Acesso: assinatura ativa ou admin,
 * checado aqui e de novo pela RLS de `posts` (has_active_subscription / is_admin).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const semAcesso = () =>
    NextResponse.json({ error: 'Sem acesso' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });

  // Checagem explícita (além da RLS): assinatura ativa ou admin.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return semAcesso();
  const [{ data: assinatura }, { data: perfil }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gte('current_period_end', new Date().toISOString())
      .maybeSingle(),
    supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(),
  ]);
  if (!assinatura && (perfil as { role?: string } | null)?.role !== 'admin') return semAcesso();

  const { data } = (await supabase
    .from('posts')
    .select('content')
    .eq('slug', slug)
    .eq('is_exclusive', true)
    .not('published_at', 'is', null)
    .maybeSingle()) as { data: { content: string | null } | null; error: unknown };

  if (!data) return semAcesso();

  return NextResponse.json(
    { html: sanitizeContent(data.content ?? '<p>Conteúdo em breve.</p>') },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
