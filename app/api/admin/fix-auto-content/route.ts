import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function isAutorizado(req: NextRequest): boolean {
  return req.nextUrl.searchParams.get('secret') === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!isAutorizado(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Busca todos os posts automáticos
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, excerpt, content')
    .eq('is_auto', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let atualizados = 0;
  let ignorados = 0;
  const erros: string[] = [];

  for (const post of posts ?? []) {
    // Só atualiza se o conteúdo não é o formato limpo novo
    const novoContent = post.excerpt ? `<p>${post.excerpt}</p>` : '<p>Conteúdo em breve.</p>';
    if (post.content === novoContent) {
      ignorados++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('posts')
      .update({ content: novoContent })
      .eq('id', post.id);

    if (updateError) {
      erros.push(`post ${post.id}: ${updateError.message}`);
    } else {
      atualizados++;
    }
  }

  return NextResponse.json({
    total: posts?.length ?? 0,
    atualizados,
    ignorados,
    erros,
  });
}
