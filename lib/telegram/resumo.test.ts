import { describe, it, expect } from 'vitest';
import { pegarEdicao } from '@/lib/whatsapp/resumo';
import { buildMensagensTelegram, escaparHtml, linkWhatsApp, urlNoticia } from './resumo';

const agora = new Date('2026-10-28T11:00:00Z'); // 08:00 de 28/10 em SP

const noticias = [
  { slug: 'fiemg-lanca-curso', title: 'FIEMG lança curso de solda' },
  { slug: 'acesita-vale', title: 'Acesita & Vale: <b>investimento</b> em DF' },
];

describe('urlNoticia', () => {
  it('monta a URL absoluta da notícia em /noticias/[slug]', () => {
    expect(urlNoticia('fiemg-lanca-curso')).toBe(
      'https://www.portalmetalmecanica.com.br/noticias/fiemg-lanca-curso'
    );
  });
});

describe('escaparHtml', () => {
  it('escapa os caracteres especiais do parse_mode HTML do Telegram', () => {
    expect(escaparHtml('A & B <i>')).toBe('A &amp; B &lt;i&gt;');
  });
});

describe('linkWhatsApp', () => {
  it('gera wa.me com título em negrito e o link (o WhatsApp monta o cartão com a foto)', () => {
    const link = linkWhatsApp(
      'Título X',
      'https://www.portalmetalmecanica.com.br/noticias/titulo-x'
    );
    expect(link.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(link.slice('https://wa.me/?text='.length))).toBe(
      '*Título X*\n\nhttps://www.portalmetalmecanica.com.br/noticias/titulo-x'
    );
  });
});

describe('buildMensagensTelegram', () => {
  const msgs = buildMensagensTelegram(pegarEdicao('manha'), noticias, agora);

  it('manda um cabeçalho + uma mensagem por notícia', () => {
    expect(msgs).toHaveLength(3);
    expect(msgs[0].text).toContain('Notícias da manhã, 28/10/2026');
  });

  it('o cabeçalho tem o nome do portal e o botão da edição inteira', () => {
    expect(msgs[0].text).toContain('📰 <b>PORTAL METALMECÂNICA</b> — Notícias da manhã, 28/10/2026');
    expect(msgs[0].link_preview_options).toEqual({ is_disabled: true });
    const botao = msgs[0].reply_markup!.inline_keyboard[0][0];
    expect(botao.text).toBe('Enviar edição completa no WhatsApp');
    const wa = decodeURIComponent(botao.url.split('text=')[1]);
    expect(wa).toBe(
      '📰 *PORTAL METALMECÂNICA* — Notícias da manhã, 28/10/2026\n\n' +
        '*FIEMG lança curso de solda*\nhttps://www.portalmetalmecanica.com.br/noticias/fiemg-lanca-curso\n\n' +
        '*Acesita & Vale: <b>investimento</b> em DF*\nhttps://www.portalmetalmecanica.com.br/noticias/acesita-vale'
    );
  });

  it('cada notícia tem título, link com prévia grande e botão pro WhatsApp', () => {
    const m = msgs[1];
    const url = 'https://www.portalmetalmecanica.com.br/noticias/fiemg-lanca-curso';
    expect(m.text).toBe(`<b>FIEMG lança curso de solda</b>\n\n${url}`);
    expect(m.link_preview_options).toEqual({ url, prefer_large_media: true });
    expect(m.reply_markup?.inline_keyboard[0][0]).toEqual({
      text: 'Enviar no WhatsApp',
      url: linkWhatsApp('FIEMG lança curso de solda', url),
    });
  });

  it('escapa HTML no texto do Telegram, mas não no texto do WhatsApp', () => {
    const m = msgs[2];
    expect(m.text).toContain('<b>Acesita &amp; Vale: &lt;b&gt;investimento&lt;/b&gt; em DF</b>');
    const wa = decodeURIComponent(m.reply_markup!.inline_keyboard[0][0].url.split('text=')[1]);
    expect(wa.startsWith('*Acesita & Vale: <b>investimento</b> em DF*')).toBe(true);
  });
});
