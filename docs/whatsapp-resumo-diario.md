# Resumo diário das notícias pro grupo do WhatsApp (3 edições/dia)

O portal envia, por um **bot do Telegram**, **3 edições por dia** pro dono. Cada notícia chega numa mensagem própria com o botão **"Enviar no WhatsApp"**: tocar abre o WhatsApp com título + link já preenchidos, você escolhe o grupo e envia. O WhatsApp monta sozinho o cartão com foto, título e descrição (lidos das meta tags `og:*` da página da notícia).

| Edição | Horário (SP) | Leva notícias de |
|---|---|---|
| 🌅 **Manhã** | 08:00 | 18:00 de ontem até 08:00 (noite/madrugada) |
| ☀️ **Meio-dia** | 13:00 | 08:00 até 13:00 |
| 🌇 **Tarde** | 18:00 | 13:00 até 18:00 |

As janelas se encaixam exatas ([18h→08h) [08h→13h) [13h→18h)) — **nenhuma notícia sai duas vezes no dia**. Cada edição manda **até 5 notícias**. Mensagem que vai pro grupo:

```
*Título da notícia*

https://www.portalmetalmecanica.com.br/noticias/slug-da-noticia
```

**Pra mudar horários ou quantidade por edição**: altere só `RESUMO_EDICOES` em `lib/whatsapp/resumo.ts` (horas em São Paulo e `maxTitulos`), e os crons correspondentes em `.github/workflows/digesto-whatsapp.yml` (horas em UTC = SP+3).

## Por que Telegram e não a API do WhatsApp?

- A Cloud API oficial **não envia pra grupos** (só com conta verificada + grupo criado pela API, máx. 8 participantes).
- Tentamos mandar pro número do dono via Cloud API (template `resumo_diario` aprovado como Marketing), mas a conta da Meta ficou **restrita até verificar a empresa** — a API aceitava (`sent: true`) e nada era entregue, nem o teste do próprio painel da Meta. Verificação exige CNPJ coerente com o site.
- Bibliotecas não-oficiais (`whatsapp-web.js`, `Baileys`) arriscam **banimento** do número.
- O bot do Telegram é grátis, sem aprovação, e o botão wa.me deixa o envio pro grupo em 3 toques por notícia.
- O WhatsApp só gera cartão com foto do **primeiro link** de cada mensagem — por isso é uma notícia por mensagem.

## O que está no código

| Arquivo | Papel |
|---|---|
| `lib/whatsapp/resumo.ts` | 3 edições e janelas por edição (fuso `America/Sao_Paulo`) |
| `lib/telegram/resumo.ts` | Monta as mensagens: cabeçalho + uma por notícia, com prévia grande do link e botão wa.me |
| `app/api/cron/whatsapp-digest/route.ts` | Rota protegida por `CRON_SECRET`; lê `?slot=` (ou deduz pela hora de SP); busca `posts` publicados da janela no Supabase; janela vazia → `sent:false`; envs faltando → 503; erro do Telegram → 502 |
| `app/og/noticia/[slug]/route.ts` | og:image em JPG 1200x630 via sharp, convertido do WebP do bucket `painel` (o WhatsApp ignora og:image em WebP) |
| `lib/seo.ts` | `absoluteUrl` (usa `NEXT_PUBLIC_APP_URL`) |
| `.github/workflows/digesto-whatsapp.yml` | 3 crons diários (11/16/21 UTC) + disparo manual com escolha de edição |

Agendamento **só** no GitHub Actions — o cron-job.org NÃO deve chamar essa rota, senão o resumo sai em dobro.

## Configuração

1. No Telegram, abra o **@BotFather** (o com selo azul ✔️ — os outros são golpe), mande `/newbot`, escolha nome e usuário terminado em `bot`. Guarde o token.
2. Abra o seu bot e mande **/start** (bot só pode escrever pra quem falou com ele antes).
3. No GitHub do projeto: **Settings → Secrets and variables → Actions**, crie `SITE_URL` (`https://www.portalmetalmecanica.com.br`) e `CRON_SECRET` (o mesmo do Vercel).
4. No Vercel (**Settings → Environment Variables**, Production): `TELEGRAM_BOT_TOKEN`. Redeploy.
5. Descobrir o chat_id: chame a rota (abaixo) — sem `TELEGRAM_CHAT_ID`, ela responde 503 com `chatsQueMandaramStart: [{ id, nome }]`. Cadastre o `id` como `TELEGRAM_CHAT_ID` no Vercel e faça redeploy.

## Testar

Painel do GitHub → **Resumo diario WhatsApp** → **Run workflow** → escolha a edição, ou local:

```powershell
curl.exe -H "Authorization: Bearer $env:CRON_SECRET" "https://www.portalmetalmecanica.com.br/api/cron/whatsapp-digest?slot=manha"
```

Resposta esperada: `{"sent":true,"edicao":"manha","mensagens":6,"titulos":[...],"janela":{...}}`. Se a janela estiver vazia: `{"sent":false, "reason":"sem notícias novas na janela desta edição (ou todas já enviadas)"}`.

Pra conferir se o cartão do WhatsApp aparece com foto: toque em "Enviar no WhatsApp" numa notícia que tenha imagem, mande pra você mesmo (mensagem privada) e veja se o link abre com foto e título.

## Limitações

- Notícias publicadas **depois das 18:00** só saem na manhã seguinte — pra uma 4ª edição, adicione uma entrada em `RESUMO_EDICOES` + um cron no workflow.
- Cada edição manda no máximo 5 notícias; a query cobre até 200 por janela (folga pro filtro de relevância do pipeline).
- O token do bot é a senha dele: se vazar, `/revoke` no @BotFather e atualize no Vercel.

## Erros comuns

| HTTP | Causa | Correção |
|---|---|---|
| 400 | `?slot=` inválido | Usar `manha`, `meio` ou `tarde` |
| 401 | `CRON_SECRET` errado | Bate com o do Vercel |
| 500 | Erro do Supabase | Ver a mensagem `error` da resposta |
| 503 | `TELEGRAM_BOT_TOKEN` ou `TELEGRAM_CHAT_ID` faltando | Cadastrar no Vercel + redeploy |
| 502 + `telegramCode: 401` | Token do bot errado/revogado | Conferir token no @BotFather |
| 502 + `telegramCode: 403` | Bot bloqueado ou sem /start | Mandar /start pro bot de novo |
| 502 + `telegramCode: 400` | `TELEGRAM_CHAT_ID` errado | Pegar o id de novo pela rota (sem a env) |

## Anti-repetição

A tabela `resumo_enviados` (migration `023_resumo_enviados.sql`) guarda o slug de cada notícia já enviada; a rota pula as que já saíram. Assim, disparo manual ou cron do GitHub atrasado não repete notícia. Rode a migration no SQL Editor do Supabase; sem ela a rota continua funcionando, mas sem deduplicar.
