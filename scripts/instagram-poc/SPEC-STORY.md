# Spec — Postagem automática de Instagram Story via Zernio

Documento de replicação. Testado e validado em produção no Portal Metalmecanica (2026-07-23, 6 Stories publicadas com sucesso). Objetivo: permitir reimplementar o mesmo fluxo em outros bots/portais trocando só os pontos marcados como **[AJUSTAR]**.

---

## 1. Visão geral do fluxo

```
notícia (título + resumo + foto + categoria)
   ↓
gera imagem 1080×1920 (HTML → screenshot via Chrome headless)
   ↓
sobe a imagem pra um storage com URL pública (CDN)
   ↓
POST /posts na API Zernio, com contentType: "story"
   ↓
poll até status = "published"
   ↓
apaga a imagem local e do storage (Instagram vira a fonte de verdade)
```

Nenhuma lib de imagem é usada (sem Sharp/Jimp/Canvas) — a composição é feita 100% em HTML/CSS e "fotografada" pelo Chrome em modo headless. Isso permite usar CSS normal (gradientes, sombras, `object-fit`, flex) em vez de programar desenho de pixel a pixel.

---

## 2. Pré-requisitos

- **Google Chrome ou Edge instalado localmente**, com o caminho do executável conhecido. Não precisa Puppeteer/Playwright — é `child_process.execFileSync` chamando o binário direto.
- **Conta Zernio já conectada ao Instagram** da marca (feito uma vez pelo painel do Zernio, fora do escopo deste script). Precisa ter:
  - `ZERNIO_API_KEY` (Bearer token da API)
  - `ZERNIO_ACCOUNT_ID` (id da conta Instagram dentro da Zernio — **não confundir com API secret**; pegar via `GET /accounts/health`, ver seção 6)
- **Storage com URL pública direta** (Supabase Storage, S3, Cloudinary, etc). A Zernio **recusa** links de Google Drive/Dropbox/OneDrive/iCloud — tem que ser CDN de verdade.
- **Logo da marca em versão branca/monocromática com fundo transparente.** Se a logo oficial tiver fundo opaco (branco, por exemplo), precisa gerar essa variante antes — ver seção 4.

---

## 3. Template HTML (a arte em si)

Dimensão fixa: **1080×1920px** (proporção 9:16, formato nativo de Story). Diferente do feed (1080×1350, 4:5) — **são dois templates separados**, não adapte um pro outro.

Camadas (ordem = z-index crescente):

1. **Foto de fundo** da notícia — `object-fit: cover`, cobre 100% do canvas.
2. **Overlay superior**: gradiente escuro→transparente nos primeiros ~420px, pra garantir contraste da logo que fica no topo.
3. **Overlay inferior**: gradiente transparente→escuro cobrindo a base (~900px), pra garantir contraste da manchete. **Importante**: a base (~250px) e o topo (~250px) do Story ficam cobertos pela UI nativa do Instagram (barra de progresso, nome da conta, campo de reply) — mantenha o conteúdo importante fora dessas margens.
4. **Logo** da marca (versão branca transparente), centralizada horizontalmente, no topo, abaixo da margem de UI do Instagram.
5. **Tag de categoria** (opcional) — pill colorido com o texto da categoria da notícia.
6. **Manchete** — texto branco, peso bold/black (900), com **autofit via JS inline** (reduz `font-size` progressivamente até caber sem estourar uma margem de segurança da base).
7. **Rodapé** (opcional) — URL do site, texto discreto.

**Sem CTA/botão de link.** Ver seção 7 — link sticker nativo não é possível via API, então não simule um.

### Template completo (adaptar cores/fonte/logo pro `[AJUSTAR]`)

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:1080px; height:1920px; overflow:hidden; }
  .story { position:relative; width:1080px; height:1920px; background:#0a0a0a; font-family:"Segoe UI",Arial,sans-serif; }

  .background {
    position:absolute; top:0; left:0; width:100%; height:100%;
    object-fit:cover; object-position:center;
  }

  .overlay-top {
    position:absolute; top:0; left:0; width:100%; height:420px; z-index:1;
    background:linear-gradient(180deg, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.0) 100%);
  }

  .overlay-bottom {
    position:absolute; bottom:0; left:0; width:100%; height:900px; z-index:1;
    background:linear-gradient(0deg,
      rgba(0,0,0,0.95) 0%,
      rgba(0,0,0,0.85) 35%,
      rgba(0,0,0,0.35) 70%,
      rgba(0,0,0,0.0) 100%
    );
  }

  .logo {
    position:absolute; z-index:2; left:50%; top:120px; transform:translateX(-50%);
    width:300px; /* [AJUSTAR] largura conforme proporção da logo da marca */
    filter:drop-shadow(0 2px 8px rgba(0,0,0,0.5));
  }

  .category {
    position:absolute; z-index:2; top:1360px; left:80px;
    background:#B8860B; /* [AJUSTAR] cor da marca */
    color:#fff; font-weight:800; font-size:28px;
    letter-spacing:1px; text-transform:uppercase;
    padding:12px 26px; border-radius:6px;
  }

  .headline {
    position:absolute; z-index:2; width:900px; left:50%; top:1450px;
    transform:translateX(-50%);
    font-size:60px; font-weight:900; line-height:1.1; letter-spacing:-1px;
    color:#FFFFFF; text-align:center;
    text-shadow:0 2px 12px rgba(0,0,0,0.7);
    text-wrap:balance;
  }

  .footer {
    position:absolute; z-index:2; bottom:56px; left:0; width:100%;
    text-align:center; color:rgba(255,255,255,0.65);
    font-size:24px; font-weight:600; letter-spacing:2px;
  }
</style>
</head>
<body>
  <div class="story">
    <img class="background" src="{{FOTO}}">
    <div class="overlay-top"></div>
    <div class="overlay-bottom"></div>
    <img class="logo" src="{{LOGO}}">
    <div class="category">{{CATEGORIA}}</div>
    <div class="headline" id="headline">{{MANCHETE}}</div>
    <div class="footer">SEUSITE.COM.BR</div> <!-- [AJUSTAR] -->
  </div>
  <script>
    (function () {
      var el = document.getElementById('headline');
      var maxBottom = 1780; // margem de seguranca antes do fim do canvas (1920)
      var size = 60;
      function bottomOf(node) { return node.getBoundingClientRect().bottom; }
      while (size > 38 && bottomOf(el) > maxBottom) {
        size -= 2;
        el.style.fontSize = size + 'px';
      }
    })();
  </script>
</body>
</html>
```

Placeholders `{{FOTO}}`, `{{LOGO}}`, `{{CATEGORIA}}`, `{{MANCHETE}}` são substituídos por `.replace()` antes de escrever o HTML final (ver seção 5). `{{FOTO}}` e `{{LOGO}}` precisam virar `file:///caminho/absoluto` (não URL remota) pro Chrome headless conseguir carregar sem depender de rede.

---

## 4. Logo: gerar versão branca transparente

Se a logo oficial da marca **já é** branca/monocromática com fundo transparente, pule esta seção.

Se a logo tem fundo opaco (ex: branco), gerar uma variante com **ffmpeg** em 3 passos — fazer `colorkey` direto sem supersampling produz bordas serrilhadas/pixeladas (alpha quase binário):

```bash
# 1. upscale 4x com lanczos (suaviza antes de extrair transparencia)
ffmpeg -y -i logo-original.png -vf "scale=W4:H4:flags=lanczos" -frames:v 1 -update 1 /tmp/logo-up4x.png

# 2. remove fundo branco + força tudo que sobrou pra branco puro, na resolucao alta
ffmpeg -y -i /tmp/logo-up4x.png -vf "colorkey=0xFFFFFF:0.12:0.06,lutrgb=r=255:g=255:b=255" -frames:v 1 -update 1 /tmp/logo-up4x-keyed.png

# 3. downscale de volta pra 2x a resolucao original (lanczos) = antialiasing de verdade
ffmpeg -y -i /tmp/logo-up4x-keyed.png -vf "scale=W2:H2:flags=lanczos" -frames:v 1 -update 1 logo-white.png
```

Onde `W4`/`H4` = 4× a largura/altura original, `W2`/`H2` = 2×. Ajustar os parâmetros do `colorkey` (`similarity:blend`) conforme o quão "sujo" é o fundo — comece com `0.12:0.06` e ajuste se sobrar mancha ou se cortar detalhe da logo.

Validar: compor a logo resultante sobre um fundo preto (`ffmpeg -f lavfi -i color=c=black:sWxH -i logo-white.png -filter_complex overlay ...`) e olhar de perto — bordas devem estar lisas, sem serrilhado.

---

## 5. Script de geração da imagem (Node, sem libs externas)

```js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = 'C:\\caminho\\pro\\chrome.exe'; // [AJUSTAR] caminho local do Chrome/Edge

function fileUrl(p) {
  return 'file:///' + path.resolve(p).replace(/\\/g, '/');
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderStory({ templatePath, fotoPath, logoPath, categoria, manchete, outPath }) {
  let html = fs.readFileSync(templatePath, 'utf8');
  html = html
    .replace('{{FOTO}}', fileUrl(fotoPath))
    .replace('{{LOGO}}', fileUrl(logoPath))
    .replace('{{CATEGORIA}}', esc(categoria))
    .replace('{{MANCHETE}}', esc(manchete));

  const tmpHtml = path.join(os.tmpdir(), 'ig-story-' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.html');
  fs.writeFileSync(tmpHtml, html, 'utf8');

  execFileSync(CHROME, [
    '--headless', '--disable-gpu', '--no-sandbox',
    '--screenshot=' + outPath,
    '--window-size=1080,1920',
    '--virtual-time-budget=3000', // tempo pro JS de autofit rodar antes do screenshot
    fileUrl(tmpHtml),
  ]);
  fs.unlinkSync(tmpHtml);
  if (!fs.existsSync(outPath)) throw new Error('PNG nao gerado: ' + outPath);
}

module.exports = { renderStory };
```

`--virtual-time-budget=3000` é essencial — sem isso o script de autofit da manchete não tem tempo de rodar antes do Chrome tirar o screenshot.

---

## 6. API Zernio — autenticação e publicação de Story

- Base URL: `https://zernio.com/api/v1`
- Auth: header `Authorization: Bearer <ZERNIO_API_KEY>` em toda chamada
- **Descobrir o `ZERNIO_ACCOUNT_ID`**: `GET /accounts/health` retorna a lista de contas conectadas com o campo `accountId`:
  ```bash
  curl -H "Authorization: Bearer $ZERNIO_API_KEY" https://zernio.com/api/v1/accounts/health
  ```
  Resposta relevante: `accounts[0].accountId`, junto com `status`, `canPost`, `tokenValid`.

- **Publicar Story**: `POST /posts`
  ```json
  {
    "mediaItems": [{ "type": "image", "url": "<URL_PUBLICA_DA_IMAGEM>" }],
    "platforms": [{
      "platform": "instagram",
      "accountId": "<ZERNIO_ACCOUNT_ID>",
      "platformSpecificData": { "contentType": "story" }
    }],
    "publishNow": true
  }
  ```
  Sem `content` (Stories não têm legenda visível) e sem `firstComment` (Stories não têm seção de comentários — diferente de post de feed).

- **Poll de confirmação**: `GET /posts/{postId}` até `post.status` ou `post.platforms[0].status` virar `published` (ou `failed`). Na prática leva ~15-20s.
  ```js
  async function pollStatus(postId, apiKey) {
    for (let i = 0; i < 10; i++) {
      const res = await fetch(`https://zernio.com/api/v1/posts/${postId}`, {
        headers: { Authorization: 'Bearer ' + apiKey },
      });
      const data = await res.json();
      const status = data.post?.status;
      const plat = data.post?.platforms?.[0];
      if (status === 'published' || plat?.status === 'published') {
        return { ok: true, url: plat?.platformPostUrl };
      }
      if (status === 'failed' || plat?.status === 'failed') {
        return { ok: false, error: plat?.error || 'falhou' };
      }
      await new Promise((r) => setTimeout(r, 8000));
    }
    return { ok: false, error: 'timeout' };
  }
  ```
- Resposta de sucesso traz `platformPostUrl` tipo `https://www.instagram.com/stories/<usuario>/<id>` — **URL efêmera, o Instagram apaga em 24h** (comportamento nativo da plataforma).
- Limite: 100 posts/24h por conta Zernio (soma feed + Story). Espaçar publicações em lote (ex: 20s entre uma e outra) evita qualquer suspeita de rate limit, mesmo estando bem abaixo do teto.

---

## 7. Limitação importante: sem link sticker

**Não é possível adicionar o link sticker nativo do Instagram (o "toque pra abrir link") via nenhuma API** — nem Zernio, nem Graph API direta da Meta. Confirmado na documentação oficial da Zernio, seção "What You Can't Do". É limitação da própria plataforma Instagram, não do provedor da API.

Implicações práticas:
- **Não** desenhe um botão/seta "arraste pra cima" ou "toque aqui" na arte — isso é enganoso, o link não vai funcionar de verdade.
- Se o link é importante, considere: publicar Story só como reforço visual (sem link), e usar o post de feed (que aceita link no primeiro comentário) como o formato "clicável".
- Alternativa manual (quebra a automação): adicionar o sticker de link manualmente pelo app do Instagram depois que a Story for publicada via API.

---

## 8. Upload pro storage (exemplo Supabase, adaptar pro storage usado)

```js
async function subirParaStorage(localPath, nomeArquivo, supabaseUrl, serviceKey, bucket) {
  const buf = fs.readFileSync(localPath);
  const objectPath = `instagram/story-${nomeArquivo}-${Date.now()}.png`;
  const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + serviceKey,
      apikey: serviceKey,
      'Content-Type': 'image/png',
      'x-upsert': 'true',
    },
    body: buf,
  });
  if (!res.ok) throw new Error('Upload falhou: ' + res.status);
  return { objectPath, publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}` };
}

async function apagarDoStorage(objectPath, supabaseUrl, serviceKey, bucket) {
  await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'DELETE',
    headers: { Authorization: 'Bearer ' + serviceKey, apikey: serviceKey },
  });
}
```

Se o storage do bot não for Supabase, trocar por S3/Cloudinary/etc — a única exigência da Zernio é que a URL final seja pública e diretamente acessível (sem auth, sem redirect pra login).

---

## 9. Limpeza pós-publicação (boa prática, não opcional)

Depois que o `pollStatus` confirmar `ok: true`:
1. Apagar o PNG local (`fs.unlinkSync`).
2. Apagar o objeto do storage remoto.

Se `ok: false` (falhou ou deu timeout), **manter** os arquivos — é a evidência pra debugar o que deu errado. Só limpar em caso de sucesso confirmado.

Motivo: a imagem gerada não tem valor depois que o Instagram já tem sua própria cópia (e a Story some em 24h de qualquer forma) — manter isso empilhando no disco/storage é desperdício, especialmente em planos free com storage limitado.

Reforçar no `.gitignore` do projeto que esses artefatos gerados nunca vão pra commit, como rede de segurança caso a limpeza automática falhe por algum erro:
```
scripts/instagram-poc/*.png
scripts/instagram-poc/*.webp
scripts/instagram-poc/tmp-foto-*
```
(ajustar o caminho pra pasta real usada no bot)

---

## 10. Checklist de replicação em outro bot

- [ ] Conta Instagram da marca conectada na Zernio (painel deles), confirmar `GET /accounts/health` retorna `healthy` + `canPost: true`
- [ ] `ZERNIO_API_KEY` e `ZERNIO_ACCOUNT_ID` salvos nas env vars do bot
- [ ] Logo branca transparente gerada e validada (bordas lisas)
- [ ] Template HTML adaptado (cor da marca, nome do site, largura da logo conforme proporção dela)
- [ ] Caminho do Chrome/Edge local confirmado
- [ ] Storage com URL pública configurado (bucket/pasta dedicados, ex: `instagram/`)
- [ ] Script de geração testado localmente (gerar 1 exemplo e olhar antes de publicar em lote)
- [ ] Fluxo completo testado com 1 publicação real antes de rodar em lote
- [ ] Limpeza pós-publicação implementada e `.gitignore` reforçado
