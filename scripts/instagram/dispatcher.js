const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = __dirname;
const PROJECT_ROOT = path.resolve(ROOT, '..', '..');
const SITE_BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://portalmetalmecanica.com.br';
const SUPABASE_URL = required('NEXT_PUBLIC_SUPABASE_URL');
const SERVICE_KEY = required('SUPABASE_SERVICE_ROLE_KEY');
const ZERNIO_KEY = required('ZERNIO_API_KEY');
const ACCOUNT_ID = required('ZERNIO_ACCOUNT_ID');
const LOOKBACK_HOURS = Number(process.env.INSTAGRAM_LOOKBACK_HOURS || 48);
const MAX_POSTS = Number(process.env.INSTAGRAM_MAX_POSTS_PER_RUN || 2);
const INTERVAL_MS = Number(process.env.INSTAGRAM_INTERVAL_MS || 20000);
const POLL_INTERVAL_MS = Number(process.env.INSTAGRAM_POLL_INTERVAL_MS || 8000);
const POLL_ATTEMPTS = Number(process.env.INSTAGRAM_POLL_ATTEMPTS || 10);
const MODE = process.argv.includes('--dry-run') ? 'dry-run' : 'publish';
const FORMAT = process.env.INSTAGRAM_FORMAT || 'both';
const TEMPLATE_ROOT = path.join(PROJECT_ROOT, 'scripts', 'instagram-poc');
const LOCK_PATH = path.join(os.tmpdir(), 'portalmetalmecanica-instagram-dispatcher.lock');

function required(name) {
  if (!process.env[name]) throw new Error(`Variável obrigatória ausente: ${name}`);
  return process.env[name];
}
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function fileUrl(filePath) { return 'file:///' + path.resolve(filePath).replace(/\\/g, '/'); }
function esc(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function slugPart(value) { return String(value || 'post').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 80); }
function headers(extra = {}) { return { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, ...extra }; }
function restUrl(table, query = '') { return `${SUPABASE_URL}/rest/v1/${table}${query}`; }
async function supabaseFetch(url, options = {}) {
  const response = await fetch(url, { ...options, headers: headers(options.headers) });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}
async function zernioFetch(url, options = {}) {
  const response = await fetch(`https://zernio.com/api/v1${url}`, {
    ...options,
    headers: { Authorization: `Bearer ${ZERNIO_KEY}`, 'Content-Type': 'application/json', ...options.headers },
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(`Zernio ${response.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  return data;
}
function acquireLock() {
  try {
    const fd = fs.openSync(LOCK_PATH, 'wx');
    fs.writeFileSync(fd, String(process.pid));
    return () => { try { fs.closeSync(fd); } catch {} try { fs.unlinkSync(LOCK_PATH); } catch {} };
  } catch { throw new Error(`Outro dispatcher já está em execução (lock: ${LOCK_PATH})`); }
}
function findBrowser() {
  const candidates = [process.env.INSTAGRAM_BROWSER, 'firefox', 'google-chrome', 'chromium', 'chromium-browser'];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try { execFileSync(candidate, ['--version'], { stdio: 'ignore' }); return candidate; } catch {}
  }
  throw new Error('Nenhum Firefox/Chrome/Chromium disponível para renderização');
}
function render({ post, format, photoPath, outPath }) {
  const browser = findBrowser();
  const templateName = format === 'story' ? 'template-story.html' : 'template.html';
  const template = fs.readFileSync(path.join(TEMPLATE_ROOT, templateName), 'utf8');
  const logo = path.join(PROJECT_ROOT, 'public', 'logo-variants', 'logo-instagram.png');
  const html = template
    .replace('{{FOTO}}', fileUrl(photoPath))
    .replace('{{LOGO}}', fileUrl(logo))
    .replace('{{CATEGORIA}}', esc(post.category || 'Notícias'))
    .replace('{{MANCHETE}}', esc(post.excerpt || post.title));
  const tmpHtml = path.join(os.tmpdir(), `instagram-${format}-${post.id}-${Date.now()}.html`);
  fs.writeFileSync(tmpHtml, html, 'utf8');
  const size = format === 'story' ? '1080,1920' : '1080,1350';
  try {
    execFileSync(browser, ['--headless', '--screenshot=' + outPath, '--window-size=' + size, '--virtual-time-budget=3000', fileUrl(tmpHtml)], { stdio: 'pipe' });
  } finally { try { fs.unlinkSync(tmpHtml); } catch {} }
  if (!fs.existsSync(outPath) || fs.statSync(outPath).size === 0) throw new Error(`PNG não gerado para ${format}`);
}
async function download(url, destination) {
  const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!response.ok) throw new Error(`Download da imagem ${response.status}: ${url}`);
  fs.writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
}
async function upload(localPath, post, format) {
  const objectPath = `instagram/${format}-${slugPart(post.slug || post.id)}-${Date.now()}.png`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/painel/${objectPath}`, {
    method: 'POST', headers: headers({ 'Content-Type': 'image/png', 'x-upsert': 'true' }), body: fs.readFileSync(localPath),
  });
  if (!response.ok) throw new Error(`Upload ${format} ${response.status}: ${await response.text()}`);
  return { objectPath, publicUrl: `${SUPABASE_URL}/storage/v1/object/public/painel/${objectPath}` };
}
async function removeStorage(objectPath) {
  if (!objectPath) return;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/painel/${objectPath}`, { method: 'DELETE', headers: headers() });
  if (!response.ok) console.warn(`Aviso: falha ao remover ${objectPath}: ${response.status}`);
}
function caption(post) {
  const category = post.category ? `#${post.category.replace(/\s+/g, '')}` : '';
  const region = post.region ? `#${post.region.replace(/\s+/g, '')}` : '';
  return [post.title, '', post.excerpt || '', '', [category, region, '#PortalMetalmecanica'].filter(Boolean).join(' ')].join('\n');
}
async function getState(postId) {
  const rows = await supabaseFetch(restUrl('instagram_social_publications', `?post_id=eq.${postId}&select=*`));
  return rows[0] || null;
}
async function ensureState(postId) {
  const rows = await supabaseFetch(restUrl('instagram_social_publications', '?on_conflict=post_id'), {
    method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=representation', 'Content-Type': 'application/json' },
    body: JSON.stringify({ post_id: postId }),
  });
  return rows[0];
}
async function updateState(postId, patch) {
  await supabaseFetch(restUrl('instagram_social_publications', `?post_id=eq.${postId}`), {
    method: 'PATCH', headers: { Prefer: 'return=minimal', 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
  });
}
function field(format, name) { return `${format}_${name}`; }
async function publish(format, post) {
  const statusName = field(format, 'status');
  const state = MODE === 'dry-run' ? ((await getState(post.id)) || {}) : await ensureState(post.id);
  if (state[statusName] === 'published') return { skipped: true, reason: 'já publicado', format };
  const photoExt = (post.featured_image.match(/\.([a-z0-9]+)(?:\?|$)/i) || [, 'webp'])[1];
  const photoPath = path.join(os.tmpdir(), `instagram-${format}-photo-${post.id}.${photoExt}`);
  const artifactPath = path.join(os.tmpdir(), `instagram-${format}-art-${post.id}-${Date.now()}.png`);
  let uploaded;
  try {
    if (MODE !== 'dry-run') {
      await updateState(post.id, { [statusName]: 'rendering', [field(format, 'attempts')]: Number(state[field(format, 'attempts')] || 0) + 1, [field(format, 'error')]: null });
    }
    await download(post.featured_image, photoPath);
    render({ post, format, photoPath, outPath: artifactPath });
    if (MODE === 'dry-run') {
      return { format, dryRun: true, dimensions: format === 'story' ? '1080x1920' : '1080x1350', artifactPath };
    }
    uploaded = await upload(artifactPath, post, format);
    await updateState(post.id, { [statusName]: 'publishing' });
    const platformSpecificData = format === 'story'
      ? { contentType: 'story' }
      : { firstComment: `📖 Leia a matéria completa: ${SITE_BASE}/noticias/${post.slug}` };
    const payload = { mediaItems: [{ type: 'image', url: uploaded.publicUrl }], platforms: [{ platform: 'instagram', accountId: ACCOUNT_ID, platformSpecificData }], publishNow: true };
    if (format === 'feed') payload.content = caption(post);
    const created = await zernioFetch('/posts', { method: 'POST', body: JSON.stringify(payload) });
    const externalId = created.post?._id;
    if (!externalId) throw new Error('Zernio não retornou post._id');
    await updateState(post.id, { [field(format, 'external_id')]: externalId });
    const result = await poll(externalId);
    if (!result.ok) throw new Error(result.error);
    await updateState(post.id, { [statusName]: 'published', [field(format, 'url')]: result.url || null, [field(format, 'error')]: null });
    await removeStorage(uploaded.objectPath);
    return { format, published: true, externalId, url: result.url || null };
  } catch (error) {
    await updateState(post.id, { [statusName]: 'failed', [field(format, 'error')]: error.message });
    return { format, published: false, error: error.message };
  } finally {
    try { fs.unlinkSync(photoPath); } catch {}
    if (MODE !== 'dry-run') { try { fs.unlinkSync(artifactPath); } catch {} }
  }
}
async function poll(externalId) {
  for (let i = 0; i < POLL_ATTEMPTS; i++) {
    const data = await zernioFetch(`/posts/${externalId}`);
    const post = data.post || {};
    const platform = post.platforms?.[0] || {};
    if (post.status === 'published' || platform.status === 'published') return { ok: true, url: platform.platformPostUrl };
    if (post.status === 'failed' || platform.status === 'failed') return { ok: false, error: platform.error || post.error || 'Zernio marcou como failed' };
    await sleep(POLL_INTERVAL_MS);
  }
  return { ok: false, error: 'timeout aguardando publicação na Zernio' };
}
async function publishedPosts() {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 3600000).toISOString();
  const query = `?published_at=gte.${encodeURIComponent(since)}&featured_image=not.is.null&select=id,slug,title,excerpt,featured_image,category,region,published_at&order=published_at.asc`;
  return supabaseFetch(restUrl('posts', query));
}
async function main() {
  const release = acquireLock();
  try {
    const allPosts = await publishedPosts();
    const formats = FORMAT === 'feed' || FORMAT === 'story' ? [FORMAT] : ['feed', 'story'];
    const candidates = [];
    for (const post of allPosts) {
      const state = MODE === 'dry-run' ? ((await getState(post.id)) || {}) : await ensureState(post.id);
      if (formats.some((format) => state[field(format, 'status')] !== 'published')) candidates.push(post);
    }
    const posts = candidates.slice(0, MAX_POSTS);
    console.log(JSON.stringify({ mode: MODE, format: FORMAT, lookbackHours: LOOKBACK_HOURS, postsFound: posts.length }));
    const results = [];
    for (const post of posts) {
      for (const format of formats) {
        const result = await publish(format, post);
        results.push({ postId: post.id, slug: post.slug, ...result });
        console.log(JSON.stringify(results.at(-1)));
      }
      if (MODE !== 'dry-run') await sleep(INTERVAL_MS);
    }
    console.log(JSON.stringify({ summary: results }));
  } finally { release(); }
}
main().catch((error) => { console.error('[instagram-dispatcher] fatal:', error.message); process.exitCode = 1; });
