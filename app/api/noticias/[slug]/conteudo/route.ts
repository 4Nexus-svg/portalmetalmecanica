import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sanitizeContent } from '@/lib/sanitize';

/**
 * Corpo de notícia exclusiva, para assinante logado. A página da notícia é
 * cacheada (ISR) e não leva o conteúdo exclusivo no HTML; o navegador do
 * assinante busca aqui com a sessão. Quem decide o acesso é a RLS de `posts`
 * (has_active_subscription / is_admin): sem acesso, a linha nem volta.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data } = (await supabase
    .from('posts')
    .select('content')
    .eq('slug', slug)
    .eq('is_exclusive', true)
    .not('published_at', 'is', null)
    .maybeSingle()) as { data: { content: string | null } | null; error: unknown };

  if (!data) {
    return NextResponse.json({ error: 'Sem acesso' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
  }

  return NextResponse.json(
    { html: sanitizeContent(data.content ?? '<p>Conteúdo em breve.</p>') },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
