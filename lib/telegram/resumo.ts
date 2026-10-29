import { absoluteUrl } from '@/lib/seo';
import { formatarDataResumo, limparTitulo, type Edicao } from '@/lib/whatsapp/resumo';

/**
 * Monta as mensagens do resumo pro bot do Telegram (Bot API, parse_mode HTML).
 *
 * Cada edição vira um cabeçalho + uma mensagem por notícia; cada notícia tem
 * um botão "Enviar no WhatsApp" (wa.me) que abre o WhatsApp com título + link
 * já preenchidos — o dono escolhe o grupo e o WhatsApp monta o cartão com foto
 * a partir das meta tags og:* da página da notícia.
 *
 * O WhatsApp só gera o cartão com foto do PRIMEIRO link de cada mensagem,
 * por isso é uma notícia por mensagem.
 */

export interface MensagemTelegram {
  text: string;
  link_preview_options?: { url: string; prefer_large_media: boolean } | { is_disabled: true };
  reply_markup?: { inline_keyboard: { text: string; url: string }[][] };
}

export function urlNoticia(slug: string): string {
  return absoluteUrl(`/noticias/${slug}`);
}

/** Escapa os 3 caracteres que o parse_mode HTML do Telegram exige. */
export function escaparHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Link wa.me que abre o WhatsApp com a mensagem pronta. Título em negrito
 * (*...*) e o link sozinho no fim — o WhatsApp só gera o cartão de prévia do
 * primeiro link da mensagem, por isso é uma notícia por mensagem.
 */
export function linkWhatsApp(titulo: string, url: string): string {
  return waMe(`*${titulo}*\n\n${url}`);
}

function waMe(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}

export function buildMensagensTelegram(
  edicao: Edicao,
  artigos: { slug: string; title: string }[],
  now: Date = new Date()
): MensagemTelegram[] {
  const rotulo = `${edicao.label}, ${formatarDataResumo(now)}`;

  // Edição inteira numa mensagem só (1 envio pro grupo). O WhatsApp monta o
  // cartão com foto só do primeiro link; os outros vão como link simples.
  const edicaoCompleta = [
    `📰 *PORTAL METALMECÂNICA* — ${rotulo}`,
    ...artigos.map((a) => `*${limparTitulo(a.title)}*\n${urlNoticia(a.slug)}`),
  ].join('\n\n');

  const cabecalho: MensagemTelegram = {
    text:
      `📰 <b>PORTAL METALMECÂNICA</b> — ${rotulo}\n` +
      `${artigos.length} ${artigos.length === 1 ? 'notícia' : 'notícias'}. ` +
      'Mande a edição inteira de uma vez pelo botão abaixo, ou cada notícia (com foto) pelo botão dela.',
    link_preview_options: { is_disabled: true },
    reply_markup: {
      inline_keyboard: [[{ text: 'Enviar edição completa no WhatsApp', url: waMe(edicaoCompleta) }]],
    },
  };

  const noticias = artigos.map((a): MensagemTelegram => {
    const titulo = limparTitulo(a.title);
    const url = urlNoticia(a.slug);
    return {
      text: `<b>${escaparHtml(titulo)}</b>\n\n${url}`,
      link_preview_options: { url, prefer_large_media: true },
      reply_markup: {
        inline_keyboard: [[{ text: 'Enviar no WhatsApp', url: linkWhatsApp(titulo, url) }]],
      },
    };
  });

  return [cabecalho, ...noticias];
}
