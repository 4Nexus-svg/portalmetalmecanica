import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const DIAS_RETENCAO = 120;

function isAutorizado(req: NextRequest): boolean {
  return (
    req.headers.get('x-vercel-cron') === '1' ||
    req.nextUrl.searchParams.get('secret') === process.env.CRON_SECRET
  );
}

function pathDoStorage(url: string): string | null {
  const marcador = '/storage/v1/object/public/painel/';
  const i = url.indexOf(marcador);
  if (i === -1) return null;
  return url.slice(i + marcador.length);
}

// Posts automáticos antigos raramente são acessados, então não vale manter a
// imagem hospedada indefinidamente (Storage do Free plan tem só 1GB). O post
// continua no ar, só sem imagem (cai no placeholder).
export async function GET(req: NextRequest) {
  if (!isAutorizado(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const limite = new Date(Date.now() - DIAS_RETENCAO * 24 * 3600_000).toISOString();

  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, featured_image')
    .eq('is_auto', true)
    .lt('published_at', limite)
    .not('featured_image', 'is', null)
    .ilike('featured_image', '%supabase.co/storage%');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const paths: string[] = [];
  const ids: number[] = [];
  for (const post of posts ?? []) {
    const path = pathDoStorage(post.featured_image as string);
    if (path) { paths.push(path); ids.push(post.id); }
  }

  if (paths.length > 0) {
    await supabase.storage.from('painel').remove(paths);
    await supabase.from('posts').update({ featured_image: null }).in('id', ids);
  }

  return NextResponse.json({ ok: true, removidas: paths.length });
}
