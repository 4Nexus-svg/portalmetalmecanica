const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const CHROME = 'C:\\Users\\2P CONNECT\\.agent-browser\\browsers\\chrome-151.0.7922.47\\chrome.exe';

function fileUrl(p) {
  return 'file:///' + path.resolve(p).replace(/\\/g, '/');
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const foto = path.join(ROOT, 'foto-story.webp');
const logo = path.join(ROOT, '..', '..', 'public', 'logo-variants', 'logo-white.png');
const manchete = 'Ibovespa perde força mesmo com Petrobras e Vale em alta';
const categoria = 'Mercado';

let html = fs.readFileSync(path.join(ROOT, 'template-story.html'), 'utf8');
html = html
  .replace('{{FOTO}}', fileUrl(foto))
  .replace('{{LOGO}}', fileUrl(logo))
  .replace('{{CATEGORIA}}', esc(categoria))
  .replace('{{MANCHETE}}', esc(manchete));

const tmpHtml = path.join(os.tmpdir(), 'ig-story-' + Date.now() + '.html');
fs.writeFileSync(tmpHtml, html, 'utf8');

const out = path.join(ROOT, 'exemplo-story.png');

execFileSync(CHROME, [
  '--headless', '--disable-gpu', '--no-sandbox',
  '--screenshot=' + out,
  '--window-size=1080,1920',
  '--virtual-time-budget=3000',
  fileUrl(tmpHtml),
]);

fs.unlinkSync(tmpHtml);
fs.unlinkSync(foto);

if (!fs.existsSync(out)) throw new Error('Falhou: PNG não foi gerado');
console.log('OK ->', out);
