import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

function isAutorizado(req: NextRequest): boolean {
  return req.nextUrl.searchParams.get('secret') === process.env.CRON_SECRET;
}

async function reescreverConteudo(titulo: string, resumo: string, fonteNome: string): Promise<string> {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Você é um jornalista sênior do Portal Metalmecânica, especializado no setor industrial brasileiro.

Com base nas informações abaixo, escreva uma matéria jornalística completa em português brasileiro.

Título: ${titulo}
Fonte: ${fonteNome}
Resumo: ${resumo}

Responda APENAS com o conteúdo HTML da matéria, usando apenas tags <p>. Escreva 4 a 6 parágrafos contextualizando o fato, seus impactos para o setor industrial e informações relevantes. Mínimo 250 palavras. Sem markdown, sem explicações, apenas o HTML.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return text.replace(/^```html?\s*/i, '').replace(/\s*```$/i, '').trim();
  } catch {
    return `<p>${resumo}</p>`;
  }
}

export async function GET(req: NextRequest) {
  if (!isAutorizado(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const limite = parseInt(req.nextUrl.searchParams.get('limite') ?? '5');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Busca posts automáticos com conteúdo curto (ainda não reescritos)
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, title, excerpt, fonte_nome')
    .eq('is_auto', true)
    .or('content.is.null,content.like.<p>%</p>')
    .limit(limite);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let atualizados = 0;
  const erros: string[] = [];

  for (const post of posts ?? []) {
    const novoConteudo = await reescreverConteudo(
      post.title,
      post.excerpt ?? '',
      post.fonte_nome ?? 'Portal Metalmecânica'
    );

    const { error: updateError } = await supabase
      .from('posts')
      .update({ content: novoConteudo })
      .eq('id', post.id);

    if (updateError) {
      erros.push(`post ${post.id}: ${updateError.message}`);
    } else {
      atualizados++;
    }
  }

  return NextResponse.json({
    processados: posts?.length ?? 0,
    atualizados,
    erros,
    msg: atualizados < (posts?.length ?? 0)
      ? 'Chame novamente para continuar os demais posts'
      : 'Todos processados',
  });
}
