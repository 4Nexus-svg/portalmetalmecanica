/**
 * Atualiza featured_image dos artigos FIEMG já inseridos sem imagem
 * Uso: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/patch-fiemg-images.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nsixodvejuhnsofpavvc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY não definida'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchImageForUrl(fonteUrl) {
  const slug = fonteUrl.replace(/\/$/, '').split('/').pop();
  const res = await fetch(
    `https://www.fiemg.com.br/wp-json/wp/v2/noticias?slug=${slug}&_fields=id,link,_links&_embed=wp:featuredmedia`,
    { headers: { 'User-Agent': 'PortalMetalmecanica/1.0' }, signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) return null;
  const posts = await res.json();
  return posts[0]?._embedded?.['wp:featuredmedia']?.[0]?.source_url ?? null;
}

async function main() {
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, fonte_url, title')
    .eq('fonte_nome', 'FIEMG')
    .is('featured_image', null);

  if (error) { console.error('Erro:', error.message); process.exit(1); }
  console.log(`${posts.length} artigos FIEMG sem imagem para corrigir.`);

  let atualizados = 0, semImagem = 0, erros = 0;

  for (const post of posts) {
    console.log(`\n[${atualizados + semImagem + erros + 1}/${posts.length}] ${post.title?.slice(0, 70)}`);
    try {
      const img = await fetchImageForUrl(post.fonte_url);
      if (!img) { console.log('  ! Sem imagem na API'); semImagem++; continue; }
      const { error: upErr } = await supabase
        .from('posts').update({ featured_image: img }).eq('id', post.id);
      if (upErr) { console.error('  ✗ Erro:', upErr.message); erros++; }
      else { console.log(`  ✓ ${img}`); atualizados++; }
    } catch (e) {
      console.error('  ✗', e.message); erros++;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n=== Concluído ===`);
  console.log(`Atualizados: ${atualizados} | Sem imagem: ${semImagem} | Erros: ${erros}`);
}

main().catch(console.error);
