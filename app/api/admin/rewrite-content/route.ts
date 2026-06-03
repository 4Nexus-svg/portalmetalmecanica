import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 300;

function isAutorizado(req: NextRequest): boolean {
  return req.nextUrl.searchParams.get('secret') === process.env.CRON_SECRET;
}

async function gerarArtigo(titulo: string, resumo: string, fonteNome: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

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
Título: ${titulo}
Fonte: ${fonteNome}
Resumo: ${resumo}`;

  const result = await model.generateContent(prompt);
  const html = result.response.text().trim()
    .replace(/^```html?\s*/i, '').replace(/\s*```$/i, '').trim();

  return html.startsWith('<p>') ? html : `<p>${html}</p>`;
}

export async function GET(req: NextRequest) {
  if (!isAutorizado(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const limite = parseInt(req.nextUrl.searchParams.get('limite') ?? '3');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Busca posts automáticos com conteúdo curto (menos de 500 chars)
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, title, excerpt, fonte_nome, content')
    .eq('is_auto', true)
    .order('id', { ascending: false })
    .limit(limite * 3); // pega mais para filtrar os curtos

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filtra só os que têm conteúdo curto
  const curtos = (posts ?? [])
    .filter(p => (p.content ?? '').length < 500)
    .slice(0, limite);

  let atualizados = 0;
  const erros: string[] = [];

  for (const post of curtos) {
    // Delay entre chamadas para respeitar rate limit
    if (atualizados > 0 || erros.length > 0) {
      await new Promise(r => setTimeout(r, 5000));
    }
    try {
      const novoConteudo = await gerarArtigo(
        post.title,
        post.excerpt ?? '',
        post.fonte_nome ?? 'Portal Metalmecânica'
      );

      const { error: updateError } = await supabase
        .from('posts')
        .update({ content: novoConteudo })
        .eq('id', post.id);

      if (updateError) erros.push(`post ${post.id}: ${updateError.message}`);
      else atualizados++;
    } catch (e) {
      erros.push(`post ${post.id}: ${e instanceof Error ? e.message : 'erro'}`);
    }
  }

  const restantes = (posts ?? []).filter(p => (p.content ?? '').length < 500).length - curtos.length;

  return NextResponse.json({
    processados: curtos.length,
    atualizados,
    erros,
    restantes_aprox: restantes > 0 ? restantes : 0,
  });
}
