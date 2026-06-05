import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateText } from '@/lib/noticias/ai-provider';

function isAutorizado(req: NextRequest): boolean {
  return req.nextUrl.searchParams.get('secret') === process.env.CRON_SECRET;
}

type PostCurto = { id: number; title: string; excerpt: string | null; content: string | null; fonte_nome: string | null };

// Mesmo prompt de artigo do ai-rewriter
async function gerarArtigo(titulo: string, fonte: string, fonteTexto: string): Promise<string> {
  const contexto = `Título: ${titulo}\nFonte: ${fonte}\nConteúdo: ${fonteTexto.slice(0, 800)}`;
  const prompt = `Você é um jornalista sênior do Portal Metalmecânica, especializado no setor industrial brasileiro (metalmecânica, siderurgia, automação, energia, mineração, petróleo).

Escreva uma matéria jornalística COMPLETA sobre a notícia abaixo. Use linguagem profissional e objetiva.

INSTRUÇÕES:
- Escreva entre 5 e 7 parágrafos usando APENAS tags <p>
- Contextualize o fato para profissionais do setor
- Mencione impactos econômicos, dados relevantes e perspectivas do mercado
- Mínimo absoluto: 350 palavras
- NÃO use outros elementos HTML além de <p>
- Responda APENAS com o HTML dos parágrafos, sem explicações, sem título

NOTÍCIA:
${contexto}`;

  const html = await generateText(prompt);
  const clean = html.replace(/^```html?\s*/i, '').replace(/\s*```$/i, '').trim();
  return clean.startsWith('<p>') ? clean : `<p>${clean}</p>`;
}

export async function POST(req: NextRequest) {
  if (!isAutorizado(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const limite = parseInt(req.nextUrl.searchParams.get('limite') ?? '5', 10);
  const minChars = parseInt(req.nextUrl.searchParams.get('min') ?? '500', 10);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Busca posts automáticos com conteúdo curto
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, title, excerpt, content, fonte_nome')
    .eq('is_auto', true)
    .order('published_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const curtos = ((posts ?? []) as PostCurto[])
    .filter((p) => (p.content?.length ?? 0) < minChars)
    .slice(0, limite);

  const reprocessados: number[] = [];
  const erros: string[] = [];

  for (const post of curtos) {
    try {
      const fonteTexto = post.excerpt || post.title;
      const novoConteudo = await gerarArtigo(post.title, post.fonte_nome ?? 'Fonte', fonteTexto);

      // Só atualiza se o novo conteúdo for substancialmente maior
      if (novoConteudo.length > (post.content?.length ?? 0)) {
        const { error: upErr } = await supabase
          .from('posts')
          .update({ content: novoConteudo })
          .eq('id', post.id);
        if (upErr) { erros.push(`${post.id}: ${upErr.message}`); continue; }
        reprocessados.push(post.id);
      } else {
        erros.push(`${post.id}: conteúdo gerado não é maior`);
      }
    } catch (e) {
      erros.push(`${post.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    candidatos: curtos.length,
    reprocessados: reprocessados.length,
    ids: reprocessados,
    erros,
  });
}
