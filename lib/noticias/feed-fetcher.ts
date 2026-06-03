import type { FeedItem, TipoFonte } from './types';
import { safeRun } from './utils';

// ─── Termos de busca para APIs ────────────────────────────────────────────────
// GNews: geral + Petrobras (2 termos — plano gratuito é limitado)
const TERMOS_GNEWS = [
  'metalmecânica siderurgia aço Brasil',
  'Petrobras petróleo gás indústria',
];

// NewsData: ES + MG (confirmado funcionando)
const TERMOS_NEWSDATA = [
  'indústria Espírito Santo',
  'siderurgia Minas Gerais',
  'Usiminas Vallourec Ipatinga',
  'Petrobras Vale industrial Brasil',
];

// Currents: sustentabilidade (1 termo)
const TERMOS_CURRENTS = [
  'energia renovável eficiência energética indústria Brasil',
];

// NewsAPI: segurança + tecnologia + geral (confirmado funcionando, 13 itens)
const TERMOS_NEWSAPI = [
  'segurança trabalho metalurgia NR indústria',
  'automação industrial robótica manufatura Brasil',
  'siderurgia aço metalmecânica mercado',
];

// ─── Feeds RSS ────────────────────────────────────────────────────────────────
// RSS confirmados funcionando (retornam itens)
const FEEDS_GERAL: { url: string; nome: string }[] = [
  { url: 'https://agenciabrasil.ebc.com.br/rss/economia/feed.xml', nome: 'Agência Brasil' },
  { url: 'https://exame.com/feed/', nome: 'Exame' },
  { url: 'https://www.infomoney.com.br/feed/', nome: 'InfoMoney' },
];

const FEEDS_DEDICADO: { url: string; nome: string }[] = [
  { url: 'https://www.ibram.org.br/rss', nome: 'IBRAM' },
];

// ─── Parsing RSS ──────────────────────────────────────────────────────────────
function extrairTexto(tag: string, xml: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
}

function extrairLink(xml: string): string {
  const m =
    xml.match(/<link[^>]*>(?:<!\[CDATA\[)?(https?[^<\]]+)(?:\]\]>)?<\/link>/i) ||
    xml.match(/<guid[^>]*>(https?[^<]+)<\/guid>/i);
  return m ? m[1].trim() : '';
}

function extrairPubDate(xml: string): Date | null {
  const patterns = [
    /<pubDate>([^<]+)<\/pubDate>/i,
    /<dc:date>([^<]+)<\/dc:date>/i,
    /<updated>([^<]+)<\/updated>/i,
    /<published>([^<]+)<\/published>/i,
  ];
  for (const p of patterns) {
    const m = xml.match(p);
    if (m) {
      const s = m[1].replace(/\bBRST\b/, '-0200').replace(/\bBRT\b/, '-0300').trim();
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function extrairImagemRSS(xml: string): string | undefined {
  const patterns = [
    /media:content[^>]+url="([^"]+)"/i,
    /media:thumbnail[^>]+url="([^"]+)"/i,
    /<enclosure[^>]+url="([^"]+)"[^>]+type="image/i,
    /<enclosure[^>]+type="image[^>]+url="([^"]+)"/i,
  ];
  for (const p of patterns) {
    const m = xml.match(p);
    if (m) return m[1];
  }
  return undefined;
}

function parsearItems(xml: string, nome: string, tipoFonte: TipoFonte): FeedItem[] {
  const items: FeedItem[] = [];
  const blocos = xml.split(/<item[\s>]|<entry[\s>]/i).slice(1);
  for (const bloco of blocos) {
    const titulo = extrairTexto('title', bloco);
    const url = extrairLink(bloco);
    const conteudo = extrairTexto('description', bloco) || extrairTexto('summary', bloco);
    const publicadoEm = extrairPubDate(bloco);
    const imagemUrl = extrairImagemRSS(bloco);
    if (!titulo || !url || !publicadoEm) continue;
    items.push({ titulo, url, conteudo, publicadoEm, imagemUrl, fonteNome: nome, tipoFonte });
  }
  return items;
}

async function fetchRSSFeed(feed: { url: string; nome: string }, tipoFonte: TipoFonte): Promise<FeedItem[]> {
  return safeRun(
    async () => {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortalMetalmecanica/1.0)' },
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      return parsearItems(xml, feed.nome, tipoFonte);
    },
    { fallback: [] as FeedItem[] }
  );
}

// ─── APIs de notícias ─────────────────────────────────────────────────────────
async function fetchGNews(): Promise<FeedItem[]> {
  const key = process.env.GNEWS_API_KEY;
  if (!key) return [];
  const items: FeedItem[] = [];
  for (const termo of TERMOS_GNEWS) {
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(termo)}&lang=pt&country=br&max=10&apikey=${key}`;
    const data = await safeRun(
      async () => {
        const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
        return res.json() as Promise<{ articles?: { title: string; url: string; description: string; publishedAt: string; image?: string }[] }>;
      },
      { fallback: { articles: [] } }
    );
    for (const a of data.articles ?? []) {
      if (!a.title || !a.url) continue;
      items.push({
        titulo: a.title,
        url: a.url,
        conteudo: a.description ?? '',
        publicadoEm: new Date(a.publishedAt),
        imagemUrl: a.image,
        fonteNome: 'GNews',
        tipoFonte: 'api',
      });
    }
  }
  return items;
}

async function fetchNewsData(): Promise<FeedItem[]> {
  const key = process.env.NEWSDATA_API_KEY;
  if (!key) return [];
  const items: FeedItem[] = [];
  for (const termo of TERMOS_NEWSDATA) {
    const url = `https://newsdata.io/api/1/news?apikey=${key}&q=${encodeURIComponent(termo)}&language=pt&country=br`;
    const data = await safeRun(
      async () => {
        const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
        return res.json() as Promise<{ results?: { title: string; link: string; description: string | null; pubDate: string; image_url?: string }[] }>;
      },
      { fallback: { results: [] } }
    );
    for (const a of data.results ?? []) {
      if (!a.title || !a.link) continue;
      items.push({
        titulo: a.title,
        url: a.link,
        conteudo: a.description ?? '',
        publicadoEm: new Date(a.pubDate),
        imagemUrl: a.image_url,
        fonteNome: 'NewsData',
        tipoFonte: 'api',
      });
    }
  }
  return items;
}

async function fetchCurrents(): Promise<FeedItem[]> {
  const key = process.env.CURRENTS_API_KEY;
  if (!key) return [];
  const termo = TERMOS_CURRENTS[0];
  const url = `https://api.currentsapi.services/v1/search?keywords=${encodeURIComponent(termo)}&language=pt&apiKey=${key}`;
  const data = await safeRun(
    async () => {
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      return res.json() as Promise<{ news?: { title: string; url: string; description: string; published: string; image?: string }[] }>;
    },
    { fallback: { news: [] } }
  );
  return (data.news ?? [])
    .filter(a => a.title && a.url)
    .map(a => ({
      titulo: a.title,
      url: a.url,
      conteudo: a.description ?? '',
      publicadoEm: new Date(a.published),
      imagemUrl: a.image && a.image !== 'None' ? a.image : undefined,
      fonteNome: 'Currents',
      tipoFonte: 'api' as TipoFonte,
    }));
}

async function fetchNewsAPI(): Promise<FeedItem[]> {
  const key = process.env.NEWSAPI_KEY;
  if (!key) return [];
  const items: FeedItem[] = [];
  for (const termo of TERMOS_NEWSAPI) {
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(termo)}&language=pt&pageSize=15&apiKey=${key}`;
    const data = await safeRun(
      async () => {
        const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
        return res.json() as Promise<{ articles?: { title: string; url: string; description: string | null; publishedAt: string; urlToImage?: string }[] }>;
      },
      { fallback: { articles: [] } }
    );
    for (const a of data.articles ?? []) {
      if (a.title === '[Removed]' || !a.url) continue;
      items.push({
        titulo: a.title,
        url: a.url,
        conteudo: a.description ?? '',
        publicadoEm: new Date(a.publishedAt),
        imagemUrl: a.urlToImage,
        fonteNome: 'NewsAPI',
        tipoFonte: 'api' as TipoFonte,
      });
    }
  }
  return items;
}

// ─── Validação de data ────────────────────────────────────────────────────────
function dentroDoLimite(item: FeedItem): boolean {
  const agora = Date.now();
  const diff = agora - item.publicadoEm.getTime();
  const limiteMs = item.tipoFonte === 'rss-dedicado' ? 24 * 3600_000 : 48 * 3600_000;
  if (diff < 0 && Math.abs(diff) > 5 * 60_000) return false;
  return diff <= limiteMs;
}

// ─── Export principal ─────────────────────────────────────────────────────────
export type FeedStats = Record<string, number>;

export async function fetchFeeds(modo = 'todos'): Promise<{ items: FeedItem[]; feedStats: FeedStats }> {
  const feedStats: FeedStats = {};
  const all: FeedItem[] = [];

  if (modo === 'todos' || modo === 'apis') {
    const [gnews, newsdata, currents, newsapi] = await Promise.all([
      fetchGNews(), fetchNewsData(), fetchCurrents(), fetchNewsAPI(),
    ]);
    for (const [nome, lote] of [
      ['GNews', gnews], ['NewsData', newsdata],
      ['Currents', currents], ['NewsAPI', newsapi],
    ] as [string, FeedItem[]][]) {
      feedStats[nome] = lote.length;
      all.push(...lote);
    }
  }

  if (modo === 'todos' || modo === 'feeds' || modo === 'feeds-rapidos') {
    const resultados = await Promise.all(FEEDS_GERAL.map(f => fetchRSSFeed(f, 'rss-geral')));
    for (let i = 0; i < FEEDS_GERAL.length; i++) {
      feedStats[FEEDS_GERAL[i].nome] = resultados[i].length;
      all.push(...resultados[i]);
    }
  }

  if (modo === 'todos' || modo === 'feeds' || modo === 'feeds-dedicados') {
    const resultados = await Promise.all(FEEDS_DEDICADO.map(f => fetchRSSFeed(f, 'rss-dedicado')));
    for (let i = 0; i < FEEDS_DEDICADO.length; i++) {
      feedStats[FEEDS_DEDICADO[i].nome] = resultados[i].length;
      all.push(...resultados[i]);
    }
  }

  const validos = all.filter(i => i.titulo && i.url && dentroDoLimite(i));
  return { items: validos, feedStats };
}
