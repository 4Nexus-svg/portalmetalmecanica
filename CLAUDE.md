# Portal Metalmecanica — Contexto do Projeto

## Stack
Next.js 16 (App Router) + React 18 + Supabase (auth/db/storage) + Stripe + Mercado Pago + Vercel. TypeScript, Tailwind, Tiptap (editor rich text), Recharts (indicadores), Sharp (imagens).

Dev roda na porta 3005: `npm run dev`.

## Estrutura

| Pasta | Função |
|---|---|
| `app/(public)/` | Home, notícias, classificados, artigos, colunistas, eventos, guia, vagas, busca, assinatura |
| `app/admin/` | Painel admin (role='admin') |
| `app/painel/` | Painel de gestão de conteúdo (notícias, classificados, colunistas, eventos, licitações, vagas, destaques, publicidade, usuários, configurações) |
| `app/assinante/dashboard/` | Área restrita ao assinante |
| `app/auth/` | Login, callback, magic link, recuperar/definir senha |
| `app/api/` | Webhooks (Stripe, Mercado Pago), cron, assinatura, classificados, indicadores, licitações, newsletter, notícias |
| `app/indicadores/`, `app/mercado/` | Páginas públicas de indicadores econômicos e mercado (exportação/importação, licitações) |
| `lib/` | Clientes Supabase, Stripe, Mercado Pago, helpers de notícias/indicadores/painel |
| `components/` | UI, layout, auth, painel, eventos, indicadores, home |
| `types/database.ts` | Tipos TypeScript das tabelas Supabase |
| `supabase/migrations/` | Schema SQL completo |

## Fluxo de notícias (área quente do código)
Publicação de notícias envolve: geração/reescrita de texto por IA, upload de imagem pro Supabase Storage, compressão via Sharp, e re-hospedagem de imagens externas. Esse pipeline já teve bugs sérios de corrupção de imagem no upload (ver histórico de commits `chore(debug)` — investigação isolou causa em content-type `image/webp` + SDK/fetch do Supabase; fix aplicado usando `https` cru ao invés do SDK). Ao mexer nesse fluxo, desconfiar de: content-type de upload, uso do SDK Supabase vs fetch nativo/undici vs https puro, e URLs relativas de imagem.

## Postagem automática no Instagram — POC funcional, testado em produção (ainda não integrado ao cron)

Status real (2026-07-23): **testado e validado publicando de verdade** na conta `@portalmetalmecanica` — dois formatos: **feed** (6 posts: 1 teste + lote de 5 cobrindo as notícias das últimas 48h) e **Story** (mesmas 6 matérias, replicado em formato 9:16). Scripts em `scripts/instagram-poc/` (nome de pasta ainda diz "poc" mas o fluxo já funciona ponta a ponta pros dois formatos). **Não está plugado no cron principal ainda** — hoje só roda manual.

### Arquivos
| Arquivo | Papel |
|---|---|
| `scripts/instagram-poc/template.html` | Template HTML/CSS da arte de **feed** (1080×1350, camadas, autofit da manchete) |
| `scripts/instagram-poc/render.js` | Gera 1 exemplo de feed (usa a última notícia publicada) — pra testar/validar visualmente |
| `scripts/instagram-poc/batch-publish.js` | Pipeline completo de **feed**: busca posts, gera arte, sobe pro Storage, publica na Zernio (post normal), confirma, limpa |
| `scripts/instagram-poc/template-story.html` | Template HTML/CSS da arte de **Story** (1080×1920, mesmas camadas mas sem CTA — link sticker nativo não é possível via API) |
| `scripts/instagram-poc/render-story.js` | Gera 1 exemplo de Story — pra testar/validar visualmente |
| `scripts/instagram-poc/batch-publish-stories.js` | Pipeline completo de **Story**: mesma lógica do feed, mas `platformSpecificData.contentType: "story"` e sem caption/firstComment (Stories não têm legenda visível nem comentários) |
| `public/logo-variants/logo-instagram.png` | Logo horizontal branca com transparência, derivada da imagem oficial enviada pelo cliente — usada nos dois formatos |

### Como a API Zernio funciona
- Serviço de terceiros (não é a Graph API da Meta direto): `https://docs.zernio.com`
- Auth: header `Authorization: Bearer <ZERNIO_API_KEY>`
- Base URL: `https://zernio.com/api/v1`
- Healthcheck de conexão/conta: `GET /accounts/health`
- Publicar: `POST /posts` com payload:
  ```json
  {
    "content": "<caption>",
    "mediaItems": [{ "type": "image", "url": "<url-publica-cdn>" }],
    "platforms": [{
      "platform": "instagram",
      "accountId": "<ZERNIO_ACCOUNT_ID>",
      "platformSpecificData": { "firstComment": "<CTA com link>" }
    }],
    "publishNow": true
  }
  ```
- **Regra crítica**: `mediaItems[0].url` tem que ser URL de CDN pública direta — Zernio não aceita link de Google Drive/Dropbox/OneDrive/iCloud. Aqui usamos o **Supabase Storage** (bucket `painel`, path `instagram/...`), mesmo bucket já usado pras imagens de notícia.
- Instagram não permite link clicável na legenda — por isso o CTA/link da matéria vai no **primeiro comentário** (`platformSpecificData.firstComment`), nunca no `content`.
- Depois de criar o post, faz polling em `GET /posts/{postId}` até status sair de `processing/publishing` pra `published`/`failed` (confirmado levar ~20s na prática).
- Limite: 100 posts/24h por conta Zernio. 6 posts com 20s de intervalo entre eles passou tranquilo.
- Env vars em `.env.local`: `ZERNIO_API_KEY` e `ZERNIO_ACCOUNT_ID` (esse último veio rotulado errado como `ZERNIO_API_SECRET` no doc de credenciais original — renomeado). Ver gotcha da env var falsa do Windows no `MELHORIA_CONTINUA.md` se a Zernio devolver 401 sem motivo aparente.

### Como a imagem do post é montada (arte 1080×1350)
Sem nenhuma lib de imagem em Node (não usa Sharp/Jimp/Canvas) — é HTML/CSS renderizado por Chrome headless (`chrome --headless --screenshot=... --window-size=1080,1350`), via `execFileSync`. Camadas (z-index crescente):
1. Foto de fundo da notícia (`object-fit: cover`, cobre 100%)
2. Overlay/degradê preto de baixo pra cima (`linear-gradient(180deg, transparente → rgba(0,0,0,0.94))`) pra garantir contraste do texto
3. Tag de categoria (canto superior esquerdo, fundo dourado)
4. Logo oficial do Instagram (`logo-instagram.png`), flutuando direto sobre a foto (sem card), centralizada horizontalmente, largura 330px, `drop-shadow` leve pra legibilidade
5. Manchete: `font-family: Segoe UI` (fallback do sistema — sem webfont carregada), peso 900, branco, `text-shadow`, com **autofit via JS inline** (reduz font-size até caber sem estourar margem inferior)
6. Rodapé com a URL do site

Formato final: **PNG, 1080×1350 (proporção 4:5, vertical)** — padrão de feed do Instagram.

**Logo**: `public/logo-variants/logo-instagram.png` é a imagem horizontal branca “PORTAL METAL MECÂNICA” enviada pelo cliente, com o fundo preto removido e transparência preservada para aplicação sobre fotos. Esta é a logo oficial dos posts de Feed e Story; não substituir por `logo-white.png` ou pelo emblema circular sem autorização.

### Legenda/caption
Montada por template, não por IA: `Título \n\n Resumo (excerpt) \n\n #Categoria #Região #PortalMetalmecanica` — reaproveita `title`/`excerpt`/`category`/`region` que já existem em `posts`, sem chamada extra de IA. A manchete usada *na imagem* também usa `excerpt` (mais descritivo que `title` sozinho). **Só vale pro feed** — Story não tem campo de legenda visível, então `batch-publish-stories.js` publica sem `content`.

### Stories (formato 1080×1920)
- API Zernio: mesmo endpoint `POST /posts`, só muda `platforms[0].platformSpecificData.contentType: "story"` (em vez de omitir esse campo, que publica no feed por padrão).
- **Link sticker nativo do Instagram (toque pra abrir link) NÃO é possível via nenhuma API** — nem Zernio, nem Graph API direta da Meta. Confirmado na doc oficial da Zernio ("What You Can't Do"). Por isso o template de Story não tem nenhum CTA/botão fake — seria enganoso.
- Story confirmada `published` retorna uma URL tipo `instagram.com/stories/<user>/<id>` — **efêmera, some em 24h** (comportamento nativo do Instagram, não da Zernio).
- Sem caption/firstComment (Stories não têm legenda visível nem seção de comentários).
- Template separado (`template-story.html`) do feed (`template.html`) — camadas parecidas (foto + overlay + logo + categoria + manchete) mas posicionamento adaptado pra área "segura" do formato vertical cheio (topo e base do Story são cobertos pela UI do app).

### Limpeza pós-publicação
A arte gerada localmente e o objeto no Supabase Storage são **apagados automaticamente depois que a Zernio confirma `status: published`** — o Instagram vira a fonte de verdade, não o disco/Storage. Se a publicação falhar ou der timeout, os arquivos ficam retidos pra debug. `.gitignore` também bloqueia qualquer PNG/webp/JSON de `scripts/instagram-poc/` de virar commit, mesmo que a limpeza automática falhe.

### Sucessor mais maduro: `scripts/instagram/dispatcher.js` (também não agendado)
Existe uma segunda implementação, em `scripts/instagram/` (pasta separada de
`instagram-poc/`), mais avançada que o POC acima e já exposta via
`npm run instagram:dispatch` / `npm run instagram:dry-run`:
- Lê candidatos direto do Supabase (`posts` publicados nas últimas
  `INSTAGRAM_LOOKBACK_HOURS`, default 48h) em vez de um `batch.json` montado
  à mão.
- Estado persistido na tabela `instagram_social_publications` (migration
  `022`, `feed_status`/`story_status` por post) em vez de arquivos locais —
  falhas ficam registradas e consultáveis, não só arquivos órfãos.
- Suporta `feed`, `story` ou `both` num único run (`INSTAGRAM_FORMAT`),
  `MAX_POSTS` configurável, lock de arquivo contra runs concorrentes, e um
  `--dry-run` real (renderiza/relata sem publicar nem mutar estado).
- Detecção portátil de navegador (Firefox/Chrome/Chromium via
  `execFileSync`) — ao contrário do `instagram-poc/`, que hardcoda um
  caminho do Chrome no Windows, este roda em Linux/servidor normal.

Na prática, `scripts/instagram/dispatcher.js` já supera funcionalmente o
`scripts/instagram-poc/` e é o caminho mais indicado para produção — falta
decidir se `instagram-poc/` deve ser aposentado.

### O que falta pra virar produção (hoje é rodada manual)
- Nenhuma das duas implementações está no cron — nem `instagram-poc/batch-publish.js` nem `scripts/instagram/dispatcher.js` têm agendamento (`vercel.json` está vazio, sem Vercel Cron; todo o cron do projeto depende de um scheduler externo tipo cron-job.org). Plugar `instagram:dispatch` nesse mesmo scheduler externo, ou no fim do pipeline de notícias (`app/api/cron/buscar-noticias`).
- Decidir: publicar toda notícia automaticamente ou só uma seleção (evitar spam/baixa qualidade no feed).
- Aposentar `scripts/instagram-poc/` em favor de `scripts/instagram/dispatcher.js` (ou integrar este último como módulo em `lib/` se virar rota da aplicação).

## Webhooks
| Gateway | Endpoint |
|---|---|
| Stripe | `POST /api/webhooks/stripe` |
| Mercado Pago | `POST /api/webhooks/mercadopago` |

## Setup rápido
1. Copiar `.env.local.example` → `.env.local` e preencher variáveis
2. Rodar `supabase/migrations/001_schema.sql` no SQL Editor do Supabase
3. `npm install`
4. `npm run dev`

## Repositório
GitHub: `4Nexus-svg/portalmetalmecanica`, branch única `main`.
