/**
 * Reescreve com IA os posts automáticos que ficaram com texto cru de RSS
 * (todos os provedores de IA falharam no momento da publicação original —
 * título truncado, "The post X appeared first on Y" etc). Também re-hospeda
 * a imagem no Storage quando possível.
 *
 * Uso: SUPABASE_SERVICE_ROLE_KEY=xxx GEMINI_API_KEY=xxx [GROQ_API_KEY=xxx] [OPENROUTER_API_KEY=xxx] \
 *      node scripts/reprocessar-posts-sem-ia.mjs [dias=3]
 */
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';

const SUPABASE_URL = 'https://nsixodvejuhnsofpavvc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY não definida'); process.exit(1); }

const DIAS = Number(process.argv[2] || 3);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const EXTENSAO_POR_MIME = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/avif': 'avif',
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite';
const GROQ_MODEL = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? 'openai/gpt-oss-120b:free';

function deveUsarFallback(err) {
  const msg = err instanceof Error ? err.message : String(err);
  return /429|503|quota|rate limit|Too Many|Service Unavailable|RESOURCE_EXHAUSTED|API_KEY_INVALID|400|not found|404|timeout|não configurada|not configured/i.test(msg);
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY não configurada');
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini timeout')), 25000)),
  ]);
  return result.response.text().trim();
}

async function callOpenAICompat(url, key, model, prompt, nome) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 2048 }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`${nome} ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0]?.message?.content?.trim() ?? '';
}

async function generateText(prompt) {
  try { return await callGemini(prompt); }
  catch (err) { if (!deveUsarFallback(err)) throw err; console.warn('  Gemini falhou, tentando Groq...'); }

  try {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY não configurada');
    return await callOpenAICompat('https://api.groq.com/openai/v1/chat/completions', key, GROQ_MODEL, prompt, 'Groq');
  } catch (err) { if (!deveUsarFallback(err)) throw err; console.warn('  Groq falhou, tentando OpenRouter...'); }

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY não configurada');
  return callOpenAICompat('https://openrouter.ai/api/v1/chat/completions', key, OPENROUTER_MODEL, prompt, 'OpenRouter');
}

const CATEGORIAS_VALIDAS = ['Mercado', 'Tecnologia', 'Industria', 'Emprego', 'Legislacao', 'Eventos', 'Siderurgia', 'Energia'];
const REGIOES_VALIDAS = ['ES', 'MG', 'Brasil', 'Internacional'];

async function reescrever(titulo, conteudo, fonteNome) {
  const contexto = `Título: ${titulo}\nFonte: ${fonteNome}\nConteúdo: ${conteudo.slice(0, 800)}`;

  const metaText = await generateText(`Você é editor do Portal Metalmecânica, portal de notícias industriais do Brasil.
Analise a notícia abaixo e responda APENAS com JSON válido (sem markdown, sem explicações):
{"titulo":"string (máx 90 chars, objetivo)","resumo":"string (máx 200 chars, 1 frase)","categoria":"Mercado|Tecnologia|Industria|Emprego|Legislacao|Eventos|Siderurgia|Energia","regiao":"ES|MG|Brasil|Internacional"}
Use Legislacao para notícias sobre NRs, normas, regulamentações, segurança do trabalho, EPI, CIPA, acidentes.

NOTÍCIA:
${contexto}`);
  const meta = JSON.parse(metaText.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim());

  const artigo = await generateText(`Você é um jornalista sênior do Portal Metalmecânica, especializado no setor industrial brasileiro (metalmecânica, siderurgia, automação, energia, mineração, petróleo).

Escreva uma matéria jornalística COMPLETA sobre a notícia abaixo. Use linguagem profissional e objetiva.

INSTRUÇÕES:
- Escreva entre 5 e 7 parágrafos usando APENAS tags <p>
- Contextualize o fato para profissionais do setor
- Mencione impactos econômicos, dados relevantes e perspectivas do mercado
- Mínimo absoluto: 350 palavras
- NÃO use outros elementos HTML além de <p>
- Responda APENAS com o HTML dos parágrafos, sem explicações, sem título

NOTÍCIA:
${contexto}`);
  const conteudoFinal = artigo.replace(/^```html?\s*/i, '').replace(/\s*```$/i, '').trim();

  return {
    titulo: (meta.titulo || titulo).slice(0, 90),
    resumo: (meta.resumo || conteudo).slice(0, 200),
    conteudo: conteudoFinal.startsWith('<p>') ? conteudoFinal : `<p>${conteudoFinal}</p>`,
    categoria: CATEGORIAS_VALIDAS.includes(meta.categoria) ? meta.categoria : 'Mercado',
    regiao: REGIOES_VALIDAS.includes(meta.regiao) ? meta.regiao : 'Brasil',
  };
}

async function extrairOgImage(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return m?.[1] ?? null;
  } catch { return null; }
}

async function baixarEHospedar(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'image/*' }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const contentType = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
  if (!EXTENSAO_POR_MIME[contentType]) throw new Error(`content-type inesperado: ${contentType || '(vazio)'}`);
  const original = Buffer.from(await res.arrayBuffer());
  if (original.byteLength === 0) throw new Error('corpo vazio');
  const comprimida = await sharp(original).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
  const path = `noticias/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;
  const { error } = await supabase.storage.from('painel').upload(path, comprimida, { contentType: 'image/webp' });
  if (error) throw new Error(error.message);
  const publicUrl = supabase.storage.from('painel').getPublicUrl(path).data.publicUrl;
  const conferencia = await fetch(publicUrl, { signal: AbortSignal.timeout(10000) });
  const bytes = Buffer.from(await conferencia.arrayBuffer());
  try {
    await sharp(bytes).metadata();
  } catch {
    await supabase.storage.from('painel').remove([path]);
    throw new Error('upload chegou corrompido no Storage');
  }
  return publicUrl;
}

function pareceTextoCru(post) {
  const semTags = (post.content || '').replace(/<[^>]+>/g, '').trim();
  return semTags.length > 0 && Math.abs(semTags.length - (post.excerpt || '').length) < 5 && semTags.length < 210;
}

async function main() {
  const since = new Date(Date.now() - DIAS * 24 * 3600_000).toISOString();
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, title, excerpt, content, featured_image, fonte_nome, fonte_url, published_at')
    .eq('is_auto', true)
    .gte('published_at', since)
    .order('published_at', { ascending: false });

  if (error) { console.error('Erro:', error.message); process.exit(1); }

  const alvos = posts.filter(pareceTextoCru);
  console.log(`${posts.length} posts nos últimos ${DIAS} dias, ${alvos.length} com texto cru (sem reescrita de IA).\n`);

  let ok = 0, erros = 0;

  for (const [i, post] of alvos.entries()) {
    process.stdout.write(`[${i + 1}/${alvos.length}] ${post.title?.slice(0, 60)}...\n`);
    try {
      const conteudoBase = (post.content || '').replace(/<[^>]+>/g, '').trim() || post.title;
      const rewrite = await reescrever(post.title, conteudoBase, post.fonte_nome);

      let featured_image = post.featured_image;
      if (featured_image && !featured_image.includes('supabase.co/storage')) {
        try {
          featured_image = await baixarEHospedar(post.featured_image);
        } catch {
          const og = await extrairOgImage(post.fonte_url);
          if (og) {
            try { featured_image = await baixarEHospedar(og); } catch { /* mantém a atual */ }
          }
        }
      }

      const { error: upErr } = await supabase
        .from('posts')
        .update({
          title: rewrite.titulo,
          excerpt: rewrite.resumo,
          content: rewrite.conteudo,
          category: rewrite.categoria,
          region: rewrite.regiao,
          featured_image,
        })
        .eq('id', post.id);
      if (upErr) throw new Error(upErr.message);

      console.log(`  ok -> "${rewrite.titulo}"`);
      ok++;
    } catch (e) {
      console.log(`  erro: ${e.message}`);
      erros++;
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(`\n=== Concluído ===\nReescritos: ${ok} | Erros: ${erros}`);
}

main().catch(console.error);
