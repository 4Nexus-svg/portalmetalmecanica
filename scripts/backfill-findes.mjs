/**
 * Backfill de notícias do FINDES desde fevereiro/2026
 * Uso: SUPABASE_SERVICE_ROLE_KEY=xxx GEMINI_API_KEY=xxx node scripts/backfill-findes.mjs
 * Opcional: --dry para simular sem inserir
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nsixodvejuhnsofpavvc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const DRY = process.argv.includes('--dry');

if (!SUPABASE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY não definida'); process.exit(1); }

function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function gerarSlugUnico(supabase, base) {
  let slug = base, t = 0;
  while (true) {
    const { data } = await supabase.from('posts').select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${++t}`;
  }
}

async function callGemini(prompt) {
  if (!GEMINI_KEY) throw new Error('sem chave');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(25000) }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

async function callOpenAICompat(url, key, model, prompt, nome) {
  if (!key) throw new Error(`${nome} sem chave`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: 2048 }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`${nome} ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

async function generateText(prompt) {
  // 1. Gemini
  try { return await callGemini(prompt); } catch (e) { console.warn('  Gemini falhou, tentando Groq...'); }
  // 2. Groq
  try { return await callOpenAICompat('https://api.groq.com/openai/v1/chat/completions', GROQ_KEY, 'llama-3.3-70b-versatile', prompt, 'Groq'); } catch (e) { console.warn('  Groq falhou, tentando OpenRouter...'); }
  // 3. OpenRouter
  return await callOpenAICompat('https://openrouter.ai/api/v1/chat/completions', OPENROUTER_KEY, 'openai/gpt-oss-120b:free', prompt, 'OpenRouter');
}

async function reescrever(titulo, conteudoHtml) {
  const texto = conteudoHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1200);
  const prompt = `Você é jornalista do Portal Metalmecânica, especializado na indústria do Espírito Santo.
Reescreva a notícia abaixo em 4-6 parágrafos usando apenas tags <p>. Linguagem objetiva, contextualize para profissionais do setor industrial capixaba. Mínimo 300 palavras.
Responda APENAS com o HTML dos parágrafos.

Título: ${titulo}
Conteúdo: ${texto}`;

  try {
    const text = await generateText(prompt);
    const clean = text.replace(/^```html?\s*/i, '').replace(/\s*```$/i, '').trim();
    return clean.startsWith('<p>') ? clean : `<p>${clean}</p>`;
  } catch {
    return null;
  }
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log('Buscando posts do FINDES desde 2026-02-01...');
  const res = await fetch(
    'https://findes.com.br/wp-json/wp/v2/posts?per_page=100&after=2026-02-01T00:00:00&_fields=id,date,slug,title,excerpt,link,content',
    { headers: { 'User-Agent': 'PortalMetalmecanica/1.0' } }
  );
  const posts = await res.json();
  console.log(`Total: ${posts.length} posts`);

  // Buscar URLs já existentes no banco
  const { data: existentes } = await supabase
    .from('posts')
    .select('fonte_url')
    .eq('fonte_nome', 'FINDES');
  const urlsExistentes = new Set((existentes ?? []).map(r => r.fonte_url));
  console.log(`Já no banco: ${urlsExistentes.size}`);

  let inseridas = 0, puladas = 0, erros = 0;

  for (const post of posts) {
    const url = post.link;
    if (urlsExistentes.has(url)) { puladas++; continue; }

    const titulo = post.title?.rendered?.replace(/&amp;/g, '&').replace(/&#\d+;/g, '').trim() ?? '';
    const excerptHtml = post.excerpt?.rendered ?? '';
    const resumo = excerptHtml.replace(/<[^>]+>/g, '').trim().slice(0, 200);
    const conteudoOriginal = post.content?.rendered ?? excerptHtml;

    console.log(`\n[${inseridas + 1}] ${titulo}`);
    console.log(`  Data: ${post.date} | URL: ${url}`);

    let conteudoFinal = conteudoOriginal;
    if (GEMINI_KEY) {
      console.log('  Reescrevendo com IA...');
      const reescrito = await reescrever(titulo, conteudoOriginal);
      if (reescrito) {
        conteudoFinal = reescrito;
        console.log('  ✓ Reescrito');
      } else {
        console.log('  ! Falhou, usando original');
      }
      // Pausa para não estourar cota da API
      await new Promise(r => setTimeout(r, 1500));
    }

    if (DRY) {
      console.log('  [DRY] Simulado');
      inseridas++;
      continue;
    }

    const slugBase = slugify(titulo).slice(0, 80);
    const slug = await gerarSlugUnico(supabase, slugBase);

    const { error } = await supabase.from('posts').insert({
      slug,
      title: titulo,
      excerpt: resumo,
      content: conteudoFinal,
      featured_image: null,
      category: 'Industria',
      region: 'ES',
      author_id: null,
      published_at: new Date(post.date).toISOString(),
      is_exclusive: false,
      fonte_url: url,
      fonte_nome: 'FINDES',
      is_auto: true,
    });

    if (error) {
      console.error('  ✗ Erro:', error.message);
      erros++;
    } else {
      console.log(`  ✓ Publicado: ${slug}`);
      inseridas++;
    }
  }

  console.log(`\n=== Concluído ===`);
  console.log(`Inseridas: ${inseridas} | Puladas: ${puladas} | Erros: ${erros}`);
}

main().catch(console.error);
