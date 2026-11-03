import { absoluteUrl } from '@/lib/seo';
import { getHistoricosCards } from '@/lib/indicadores/queries';

/**
 * Cards de indicadores de mercado do resumo do Telegram (edições da manhã e da
 * tarde). Três cards separados — financeiros, commodities e regional ES/MG —,
 * cada um enviado como imagem (rota /og/indicadores/[grupo]) com a versão em
 * texto na legenda e no botão "Enviar no WhatsApp".
 *
 * Minério de ferro fica de fora: a fonte (Yahoo TIO=F) está parada desde
 * ago/2021 e repete o mesmo valor todo dia.
 */

export type GrupoCard = 'financeiros' | 'commodities' | 'regional';

export const GRUPOS_CARD: readonly GrupoCard[] = ['financeiros', 'commodities', 'regional'];

type Formato = 'real' | 'pontos' | 'taxa' | 'usd' | 'indice' | 'usd_mi';

interface ItemConfig {
  slug: string;
  nome: string;
  emoji: string;
  formato: Formato;
  casas: number;
  /** Sufixo após o valor em US$, ex.: "/t". */
  sufixo?: string;
  /** Dado mensal com variação ano contra ano (regional). */
  mensal?: boolean;
}

interface GrupoConfig {
  titulo: string;
  itens: ItemConfig[];
}

export const CARDS_CONFIG: Record<GrupoCard, GrupoConfig> = {
  financeiros: {
    titulo: 'Indicadores financeiros',
    itens: [
      { slug: 'dolar', nome: 'Dólar', emoji: '💵', formato: 'real', casas: 2 },
      { slug: 'euro', nome: 'Euro', emoji: '💶', formato: 'real', casas: 2 },
      { slug: 'ibovespa', nome: 'Ibovespa', emoji: '📈', formato: 'pontos', casas: 0 },
      { slug: 'selic', nome: 'Selic', emoji: '🏦', formato: 'taxa', casas: 2 },
    ],
  },
  commodities: {
    titulo: 'Commodities industriais',
    itens: [
      { slug: 'aco', nome: 'Aço HRC', emoji: '🏗️', formato: 'usd', casas: 0, sufixo: '/t' },
      { slug: 'aluminio', nome: 'Alumínio', emoji: '🥫', formato: 'usd', casas: 0, sufixo: '/t' },
      { slug: 'cobre', nome: 'Cobre', emoji: '🔶', formato: 'usd', casas: 2, sufixo: '/lb' },
      { slug: 'petroleo', nome: 'Petróleo Brent', emoji: '🛢️', formato: 'usd', casas: 2, sufixo: '/barril' },
    ],
  },
  regional: {
    titulo: 'Indústria ES e MG',
    itens: [
      { slug: 'producao_es', nome: 'Produção industrial ES', emoji: '🏭', formato: 'indice', casas: 1, mensal: true },
      { slug: 'producao_mg', nome: 'Produção industrial MG', emoji: '🏭', formato: 'indice', casas: 1, mensal: true },
      { slug: 'exportacoes_es', nome: 'Exportações ES', emoji: '🚢', formato: 'usd_mi', casas: 0, mensal: true },
      { slug: 'exportacoes_mg', nome: 'Exportações MG', emoji: '🚢', formato: 'usd_mi', casas: 0, mensal: true },
    ],
  },
};

/** Cotação diária/horária mais velha que isso não entra no card (fonte parada). */
const VALIDADE_MS = 4 * 24 * 60 * 60 * 1000;

export interface SnapshotIndicador {
  value: number;
  variation: number | null;
  captured_at: string;
  raw_data?: Record<string, unknown> | null;
}

export interface ItemCard {
  nome: string;
  emoji: string;
  valor: string;
  /** Variação em %, ou null quando não há base de comparação (ex.: Selic). */
  variacao: number | null;
  /** O que a variação compara, ex.: "no dia" ou "ago/26 x ago/25". */
  legenda: string | null;
}

export interface CardIndicadores {
  grupo: GrupoCard;
  titulo: string;
  itens: ItemCard[];
  /** Captura mais recente entre os itens do card. */
  atualizadoEm: Date;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function numero(valor: number, casas: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function formatarValor(valor: number, item: Pick<ItemConfig, 'formato' | 'casas' | 'sufixo'>): string {
  const n = numero(valor, item.casas);
  switch (item.formato) {
    case 'real': return `R$ ${n}`;
    case 'pontos': return `${n} pts`;
    case 'taxa': return `${n}% a.a.`;
    case 'usd': return `US$ ${n}${item.sufixo ?? ''}`;
    case 'indice': return n;
    case 'usd_mi': return `US$ ${n} mi`;
  }
}

/** "+0,42%" / "-1,30%" / "0,00%". */
export function formatarVariacao(variacao: number): string {
  const v = Math.round(variacao * 100) / 100;
  const sinal = v > 0 ? '+' : v < 0 ? '-' : '';
  return `${sinal}${numero(Math.abs(v), 2)}%`;
}

/** Período dos dados mensais ("202608" do IBGE ou "2026-07" do MDIC) → "ago/26 x ago/25". */
export function legendaMensal(raw: Record<string, unknown> | null | undefined): string | null {
  const periodo = String(raw?.period ?? '');
  const m = periodo.match(/^(\d{4})-?(\d{2})$/);
  if (!m) return 'x ano anterior';
  const ano = Number(m[1]);
  const mes = MESES[Number(m[2]) - 1];
  if (!mes) return 'x ano anterior';
  const aa = (a: number) => String(a).slice(2);
  return `${mes}/${aa(ano)} x ${mes}/${aa(ano - 1)}`;
}

/**
 * Variação no dia quando a fonte não grava (Dólar, Euro): compara com a
 * captura mais recente feita pelo menos 20h antes da última.
 */
export function variacaoDiaria(historico: SnapshotIndicador[]): number | null {
  const [ultimo, ...anteriores] = historico;
  if (!ultimo) return null;
  if (ultimo.variation !== null) return ultimo.variation;
  const limite = new Date(ultimo.captured_at).getTime() - 20 * 60 * 60 * 1000;
  const base = anteriores.find((s) => new Date(s.captured_at).getTime() <= limite);
  if (!base || base.value === 0) return null;
  return ((ultimo.value - base.value) / base.value) * 100;
}

/**
 * Monta os cards a partir do histórico de cada indicador (mais recente
 * primeiro). Cotação parada há mais de 4 dias sai do card; card sem nenhum
 * item não é gerado.
 */
export function montarCards(
  historicos: Record<string, SnapshotIndicador[]>,
  agora: Date = new Date(),
  grupos: readonly GrupoCard[] = GRUPOS_CARD
): CardIndicadores[] {
  const cards: CardIndicadores[] = [];

  for (const grupo of grupos) {
    const config = CARDS_CONFIG[grupo];
    const itens: ItemCard[] = [];
    let atualizadoEm = 0;

    for (const item of config.itens) {
      const historico = historicos[item.slug] ?? [];
      const ultimo = historico[0];
      if (!ultimo) continue;
      const capturado = new Date(ultimo.captured_at).getTime();
      if (!item.mensal && agora.getTime() - capturado > VALIDADE_MS) continue;

      // Selic: a taxa só muda nas reuniões do Copom, não tem variação diária.
      const semVariacao = item.slug === 'selic';
      const variacao = semVariacao
        ? null
        : item.mensal
          ? ultimo.variation
          : variacaoDiaria(historico);

      itens.push({
        nome: item.nome,
        emoji: item.emoji,
        valor: formatarValor(ultimo.value, item),
        variacao,
        legenda: variacao === null ? null : item.mensal ? legendaMensal(ultimo.raw_data) : 'no dia',
      });
      atualizadoEm = Math.max(atualizadoEm, capturado);
    }

    if (itens.length > 0) {
      cards.push({ grupo, titulo: config.titulo, itens, atualizadoEm: new Date(atualizadoEm) });
    }
  }

  return cards;
}

/** Lê o banco e monta os cards dos grupos pedidos. */
export async function buscarCards(
  grupos: readonly GrupoCard[] = GRUPOS_CARD,
  agora: Date = new Date()
): Promise<CardIndicadores[]> {
  const itens = grupos.flatMap((g) => CARDS_CONFIG[g].itens);
  const historicos = await getHistoricosCards(
    itens.map((i) => i.slug),
    itens.filter((i) => i.mensal).map((i) => i.slug)
  );
  return montarCards(historicos, agora, grupos);
}

export function urlIndicadores(): string {
  return absoluteUrl('/indicadores');
}

function linhaVariacao(item: ItemCard): string {
  if (item.variacao === null) return '';
  return ` (${formatarVariacao(item.variacao)}${item.legenda ? ` ${item.legenda}` : ''})`;
}

function dataCurta(data: Date): string {
  return data.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Legenda da foto no Telegram (parse_mode HTML). */
export function legendaTelegram(card: CardIndicadores): string {
  const linhas = card.itens.map((i) => `${i.emoji} ${i.nome}: <b>${i.valor}</b>${linhaVariacao(i)}`);
  return [
    `📊 <b>${card.titulo.toUpperCase()}</b>`,
    ...linhas,
    `Atualizado em ${dataCurta(card.atualizadoEm)}`,
  ].join('\n');
}

/** Texto pro WhatsApp (*negrito*), com o link da página de indicadores. */
export function textoWhatsApp(card: CardIndicadores): string {
  const linhas = card.itens.map((i) => `${i.emoji} ${i.nome}: *${i.valor}*${linhaVariacao(i)}`);
  return [
    `📊 *${card.titulo.toUpperCase()}* — Portal Metalmecânica`,
    '',
    ...linhas,
    '',
    `Mais indicadores: ${urlIndicadores()}`,
  ].join('\n');
}
