import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nsixodvejuhnsofpavvc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = 'openai/gpt-oss-120b:free';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function ai(prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const d = await res.json();
  return d.choices[0]?.message?.content?.trim() ?? '';
}

async function fetchConteudoFundacentro(fonteUrl) {
  // Converte URL pública para URL da API Plone
  const apiUrl = fonteUrl.replace('https://www.gov.br/fundacentro', 'https://www.gov.br/fundacentro/++api++');
  const res = await fetch(apiUrl, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; PortalMetalmecanica/1.0)' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) return null;
  const data = await res.json();

  // Extrai texto dos blocos slate do Plone
  const textos = [];
  for (const bloco of Object.values(data.blocks || {})) {
    if (bloco.plaintext?.trim()) textos.push(bloco.plaintext.trim());
  }
  return {
    titulo: data.title,
    descricao: data.description,
    conteudo: textos.join(' ').slice(0, 1500),
  };
}

async function reescrever(titulo, conteudo, fonteNome) {
  const contexto = `Título: ${titulo}\nFonte: ${fonteNome}\nConteúdo: ${conteudo}`;

  // Metadados
  const metaText = await ai(`Você é editor do Portal Metalmecânica, portal de notícias industriais do Brasil.
Analise a notícia abaixo e responda APENAS com JSON válido (sem markdown):
{"titulo":"string (máx 90 chars)","resumo":"string (máx 200 chars, 1 frase)","regiao":"ES|MG|Brasil|Internacional"}

NOTÍCIA:
${contexto}`);

  let meta;
  try {
    meta = JSON.parse(metaText.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim());
  } catch {
    meta = { titulo, resumo: conteudo.slice(0, 200), regiao: 'Brasil' };
  }

  // Artigo completo
  const artigo = await ai(`Você é jornalista sênior do Portal Metalmecânica, especializado no setor industrial brasileiro.
Escreva matéria jornalística COMPLETA. Use linguagem profissional e objetiva.
- Entre 5 e 7 parágrafos usando APENAS tags <p>
- Contextualize para profissionais do setor industrial
- Destaque impactos práticos para empresas e trabalhadores
- Mínimo 350 palavras. Apenas <p>, sem título, sem markdown.

NOTÍCIA:
${contexto}`);

  const conteudoFinal = artigo.replace(/^```html?\s*/i, '').replace(/\s*```$/i, '').trim();

  return {
    titulo: (meta.titulo || titulo).slice(0, 90),
    resumo: (meta.resumo || conteudo).slice(0, 200),
    conteudo: conteudoFinal.startsWith('<p>') ? conteudoFinal : `<p>${conteudoFinal}</p>`,
    regiao: meta.regiao || 'Brasil',
  };
}

async function main() {
  // Busca todas as notícias da Fundacentro no banco
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, title, excerpt, content, fonte_url')
    .eq('fonte_nome', 'Fundacentro')
    .order('published_at', { ascending: false });

  if (error) { console.error('Erro ao buscar posts:', error.message); return; }
  console.log(`${posts.length} artigos da Fundacentro encontrados.\n`);

  // Filtra os que têm conteúdo curto (fallback = só o resumo em 1 <p>)
  const paraReprocessar = posts.filter(p => {
    const semTags = (p.content || '').replace(/<[^>]+>/g, '').trim();
    return semTags.length < 400;
  });

  const LIMITE = 7; // já foram 3 antes = 10 total
  console.log(`${paraReprocessar.length} com texto curto — processando os próximos ${LIMITE}...\n`);
  paraReprocessar.splice(LIMITE);

  let ok = 0, erros = 0;

  for (const post of paraReprocessar) {
    process.stdout.write(`[${ok + erros + 1}/${paraReprocessar.length}] ${post.title.slice(0, 60)}... `);
    try {
      const dados = await fetchConteudoFundacentro(post.fonte_url);
      const conteudoBase = dados?.conteudo || post.excerpt || post.title;

      const rewrite = await reescrever(
        dados?.titulo || post.title,
        conteudoBase,
        'Fundacentro'
      );

      const { error: updateError } = await supabase
        .from('posts')
        .update({
          title: rewrite.titulo,
          excerpt: rewrite.resumo,
          content: rewrite.conteudo,
          region: rewrite.regiao,
          category: 'Legislacao',
        })
        .eq('id', post.id);

      if (updateError) throw new Error(updateError.message);

      console.log('✓');
      ok++;
      // Pequena pausa para não estourar rate limit
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) {
      console.log(`✗ ${e.message}`);
      erros++;
    }
  }

  console.log(`\nConcluído: ${ok} atualizados, ${erros} erros.`);
}

main().catch(console.error);
