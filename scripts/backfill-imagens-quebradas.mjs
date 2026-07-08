/**
 * Re-hospeda no Storage as imagens de posts cuja featured_image aponta pra
 * URL externa (hotlink). Corrige quebra causada por WAF/anti-bot de terceiros
 * (ex.: gov.br/Fundacentro devolvendo 401/ORB depois de um tempo).
 * Uso: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/backfill-imagens-quebradas.mjs [fonte_nome]
 */
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const SUPABASE_URL = 'https://nsixodvejuhnsofpavvc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY não definida'); process.exit(1); }

const FONTE = process.argv[2] || 'Fundacentro';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const EXTENSAO_POR_MIME = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
  'image/webp': 'webp', 'image/avif': 'avif',
};

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function baixarEHospedar(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'image/*' },
    signal: AbortSignal.timeout(10000),
  });
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

async function extrairOgImage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;
  const html = await res.text();
  const ogMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return ogMatch?.[1] ?? null;
}

async function main() {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, title, fonte_url, featured_image')
    .eq('fonte_nome', FONTE)
    .not('featured_image', 'is', null)
    .not('featured_image', 'ilike', `%supabase.co/storage%`);

  if (error) { console.error('Erro:', error.message); process.exit(1); }
  console.log(`${posts.length} posts de "${FONTE}" com imagem externa (possivelmente quebrada).\n`);

  let ok = 0, semImagem = 0, erros = 0;

  for (const [i, post] of posts.entries()) {
    process.stdout.write(`[${i + 1}/${posts.length}] ${post.title?.slice(0, 60)}... `);
    try {
      let hospedada = null;
      try {
        hospedada = await baixarEHospedar(post.featured_image);
      } catch {
        const og = await extrairOgImage(post.fonte_url);
        if (og) hospedada = await baixarEHospedar(og);
      }

      if (!hospedada) {
        // Sem imagem disponível em lugar nenhum — limpa o link quebrado pra
        // UI cair no placeholder em vez de mostrar ícone de imagem quebrada.
        await supabase.from('posts').update({ featured_image: null }).eq('id', post.id);
        console.log('sem imagem disponível, limpo');
        semImagem++;
        continue;
      }

      const { error: upErr } = await supabase
        .from('posts').update({ featured_image: hospedada }).eq('id', post.id);
      if (upErr) throw new Error(upErr.message);

      console.log(`ok -> ${hospedada}`);
      ok++;
    } catch (e) {
      console.log(`erro: ${e.message}`);
      erros++;
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  console.log(`\n=== Concluído ===\nRe-hospedadas: ${ok} | Sem imagem: ${semImagem} | Erros: ${erros}`);
}

main().catch(console.error);
