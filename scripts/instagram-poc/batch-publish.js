const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const CHROME = 'C:\\Users\\2P CONNECT\\.agent-browser\\browsers\\chrome-151.0.7922.47\\chrome.exe';
const SITE_BASE = 'https://portalmetalmecanica.com.br';
const ACCOUNT_ID = process.env.ZERNIO_ACCOUNT_ID;
const ZERNIO_KEY = process.env.ZERNIO_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fileUrl(p) {
  return 'file:///' + path.resolve(p).replace(/\\/g, '/');
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function baixarFoto(url, destino) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destino, buf);
}

function renderArte({ fotoPath, categoria, manchete, outPath }) {
  const logo = path.join(ROOT, '..', '..', 'public', 'logo-variants', 'logo-white.png');
  let html = fs.readFileSync(path.join(ROOT, 'template.html'), 'utf8');
  html = html
    .replace('{{FOTO}}', fileUrl(fotoPath))
    .replace('{{LOGO}}', fileUrl(logo))
    .replace('{{CATEGORIA}}', esc(categoria))
    .replace('{{MANCHETE}}', esc(manchete));

  const tmpHtml = path.join(os.tmpdir(), 'ig-arte-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.html');
  fs.writeFileSync(tmpHtml, html, 'utf8');

  execFileSync(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox',
    '--screenshot=' + outPath,
    '--window-size=1080,1350',
    '--virtual-time-budget=3000',
    fileUrl(tmpHtml),
  ]);
  fs.unlinkSync(tmpHtml);
  if (!fs.existsSync(outPath)) throw new Error('PNG nao gerado: ' + outPath);
}

async function subirParaStorage(localPath, slug) {
  const buf = fs.readFileSync(localPath);
  const objectPath = `instagram/${slug}-${Date.now()}.png`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/painel/${objectPath}`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + SERVICE_KEY,
      apikey: SERVICE_KEY,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: buf,
  });
  if (!res.ok) throw new Error('Upload falhou: ' + res.status + ' ' + (await res.text()));
  return { objectPath, publicUrl: `${SUPABASE_URL}/storage/v1/object/public/painel/${objectPath}` };
}

async function apagarDoStorage(objectPath) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/painel/${objectPath}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + SERVICE_KEY, apikey: SERVICE_KEY },
  });
  if (!res.ok) console.warn('Aviso: falha ao apagar do Storage:', objectPath, res.status);
}

function montarCaption({ title, excerpt, category, region }) {
  const tagCategoria = '#' + category.replace(/\s+/g, '');
  const tagRegiao = region ? '#' + region.replace(/\s+/g, '') : '';
  const fixas = '#PortalMetalmecanica';
  return [title, '', excerpt, '', [tagCategoria, tagRegiao, fixas].filter(Boolean).join(' ')].join('\n');
}

async function publicarZernio({ imagemUrl, caption, linkMateria }) {
  const payload = {
    content: caption,
    mediaItems: [{ type: 'image', url: imagemUrl }],
    platforms: [{
      platform: 'instagram',
      accountId: ACCOUNT_ID,
      platformSpecificData: { firstComment: `📖 Leia a matéria completa: ${linkMateria}` },
    }],
    publishNow: true,
  };
  const res = await fetch('https://zernio.com/api/v1/posts', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + ZERNIO_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error('Zernio create falhou: ' + res.status + ' ' + JSON.stringify(data));
  return data.post._id;
}

async function pollStatus(postId) {
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`https://zernio.com/api/v1/posts/${postId}`, {
      headers: { Authorization: 'Bearer ' + ZERNIO_KEY },
    });
    const data = await res.json();
    const status = data.post?.status;
    const plat = data.post?.platforms?.[0];
    if (status === 'published' || plat?.status === 'published') {
      return { ok: true, url: plat?.platformPostUrl, status };
    }
    if (status === 'failed' || plat?.status === 'failed') {
      return { ok: false, error: plat?.error || data.post?.error || 'falhou', status };
    }
    await sleep(8000);
  }
  return { ok: false, error: 'timeout aguardando publicação' };
}

async function processarUm(post) {
  console.log(`\n=== ${post.title} (id ${post.id}) ===`);
  const ext = (post.featured_image.match(/\.(\w+)(\?|$)/) || [, 'webp'])[1];
  const fotoPath = path.join(ROOT, `tmp-foto-${post.id}.${ext}`);
  const artePath = path.join(ROOT, `arte-${post.slug}.png`);

  console.log('baixando foto...');
  await baixarFoto(post.featured_image, fotoPath);

  console.log('renderizando arte...');
  renderArte({
    fotoPath,
    categoria: post.category,
    manchete: post.excerpt || post.title,
    outPath: artePath,
  });

  console.log('subindo pro storage...');
  const { objectPath, publicUrl } = await subirParaStorage(artePath, post.slug);
  console.log('URL:', publicUrl);

  const caption = montarCaption(post);
  const linkMateria = `${SITE_BASE}/noticias/${post.slug}`;

  console.log('publicando na Zernio...');
  const postId = await publicarZernio({ imagemUrl: publicUrl, caption, linkMateria });
  console.log('postId Zernio:', postId, '- aguardando confirmação...');

  const resultado = await pollStatus(postId);

  // limpeza: a foto baixada sempre pode sumir; a arte e o objeto no Storage só
  // depois de confirmar a publicação (senão perde a evidência pra debugar falha)
  fs.unlinkSync(fotoPath);
  if (resultado.ok) {
    fs.unlinkSync(artePath);
    await apagarDoStorage(objectPath);
    console.log('limpeza ok: arte local e do Storage removidas (Instagram é a fonte de verdade agora)');
  } else {
    console.log('publicação NÃO confirmada — mantendo arte local e no Storage pra debug:', artePath);
  }

  return { ...post, imagemUrl: publicUrl, postId, resultado };
}

async function main() {
  const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'batch.json'), 'utf8'));
  // ordem cronológica (mais antiga primeiro), respeitando um intervalo entre posts
  posts.sort((a, b) => a.id - b.id);

  const resultados = [];
  for (const post of posts) {
    try {
      const r = await processarUm(post);
      resultados.push(r);
      console.log(r.resultado.ok ? `OK -> ${r.resultado.url}` : `FALHOU -> ${r.resultado.error}`);
    } catch (e) {
      console.error('ERRO em', post.title, ':', e.message);
      resultados.push({ ...post, erro: e.message });
    }
    await sleep(20000); // espaçar publicações
  }

  fs.writeFileSync(path.join(ROOT, 'batch-resultado.json'), JSON.stringify(resultados, null, 2));
  console.log('\n\n=== RESUMO ===');
  for (const r of resultados) {
    if (r.erro) console.log(`✗ ${r.title}: ERRO - ${r.erro}`);
    else if (r.resultado?.ok) console.log(`✓ ${r.title}: ${r.resultado.url}`);
    else console.log(`✗ ${r.title}: ${r.resultado?.error}`);
  }
}

main();
