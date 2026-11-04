// Reenvia as imagens de notícia já existentes no bucket `painel` com
// Cache-Control de 1 ano (o Storage não permite editar só o metadado).
//
// Uso:
//   node scripts/backfill-cache-control.mjs            # dry-run (só lista/conta)
//   node scripts/backfill-cache-control.mjs --apply    # executa
//   node scripts/backfill-cache-control.mjs --apply --limit=20   # lote de teste
//
// Segurança: baixa o objeto, confere que o tamanho bate, sobe por https cru
// (o SDK já corrompeu uploads neste projeto) com x-upsert e confere de novo.
// Se qualquer conferência falhar, pula o objeto (o original continua intacto
// até o upsert terminar com sucesso).
import https from 'node:https';
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes('--apply');
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) ?? '').split('=')[1]) || Infinity;
const BUCKET = 'painel';
const PREFIXO = 'noticias/';
const ALVO = 'max-age=31536000';

const auth = { Authorization: `Bearer ${KEY}`, apikey: KEY };

async function listar() {
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const r = await fetch(`${URL_BASE}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: PREFIXO.replace(/\/$/, ''), limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
    });
    if (!r.ok) throw new Error(`list ${r.status}: ${await r.text()}`);
    const lote = await r.json();
    out.push(...lote.filter((o) => o.id));
    if (lote.length < 1000) break;
  }
  return out.map((o) => ({ path: PREFIXO + o.name, tipo: o.metadata?.mimetype ?? 'image/webp', tam: o.metadata?.size, cc: o.metadata?.cacheControl ?? '' }));
}

function subir(path, buffer, tipo) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: new URL(URL_BASE).host,
      path: `/storage/v1/object/${BUCKET}/${path}`,
      method: 'POST',
      headers: { ...auth, 'Content-Type': tipo, 'Content-Length': buffer.length, 'Cache-Control': ALVO, 'x-upsert': 'true' },
    }, (res) => {
      res.resume();
      res.on('end', () => (res.statusCode < 300 ? resolve() : reject(new Error(`HTTP ${res.statusCode}`))));
    });
    req.on('error', reject);
    req.end(buffer);
  });
}

const publica = (p) => `${URL_BASE}/storage/v1/object/public/${BUCKET}/${p}`;

const objetos = await listar();
console.log(`Objetos em ${BUCKET}/${PREFIXO}: ${objetos.length}`);

// Decide pelos metadados do Storage (a CDN pode servir o cabeçalho antigo por até 1h).
let pendentes = objetos.filter((o) => !o.cc.includes('31536000')).slice(0, LIMIT);
console.log(`Sem cache longo: ${pendentes.length}`);
if (!APPLY) { console.log('Dry-run: nada alterado. Use --apply para executar.'); process.exit(0); }

let ok = 0, falhas = 0;
for (const o of pendentes) {
  try {
    const r = await fetch(publica(o.path));
    if (!r.ok) throw new Error(`download ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (o.tam && buf.length !== o.tam) throw new Error(`tamanho ${buf.length} != ${o.tam}`);
    await subir(o.path, buf, o.tipo);
    // Confere pelos metadados (CDN pode estar com o cabeçalho antigo em cache).
    const m = await fetch(`${URL_BASE}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: 'noticias', limit: 1, search: o.path.slice(PREFIXO.length) }),
    });
    const meta = (await m.json())[0]?.metadata;
    if (!meta || meta.size !== buf.length || !String(meta.cacheControl).includes('31536000'))
      throw new Error('conferência pós-upload falhou');
    ok++;
  } catch (e) {
    falhas++;
    console.error(`FALHA ${o.path}: ${e.message}`);
  }
}
console.log(`Concluído. ok=${ok} falhas=${falhas}`);
