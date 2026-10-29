/**
 * As 3 edições diárias do resumo de notícias (manhã 08h, meio-dia 13h e tarde
 * 18h de São Paulo) e a janela [início, fim) de cada uma.
 *
 * Cada edição leva as notícias publicadas desde a anterior — as 3 janelas do
 * dia se encaixam sem sobreposição ([18h→08h) [08h→13h) [13h→18h)), então
 * nenhuma notícia aparece duas vezes no dia.
 *
 * O resumo é entregue pro dono por um bot do Telegram (ver lib/telegram/resumo.ts)
 * e encaminhado ao grupo do WhatsApp pelo dono — a Cloud API da Meta foi
 * descartada por não enviar a grupos e restringir a conta sem verificação de
 * empresa (ver docs/whatsapp-resumo-diario.md).
 */

export type EdicaoSlug = 'manha' | 'meio' | 'tarde';

export interface Edicao {
  slug: EdicaoSlug;
  /** Rótulo que aparece na mensagem, ex.: "Notícias da manhã". */
  label: string;
  /** Hora prevista de envio em São Paulo (o cron do GH Actions dispara em UTC). */
  horaEnvioSp: number;
  /**
   * Tamanho da janela de notícias desta edição, contada pra trás da hora
   * agendada. As 3 janelas do dia se encaixam exatas: [18h→08h) [08h→13h) [13h→18h).
   */
  janelaHorasAtras: number;
  /** Quantidade de notícias desta edição (do mais recente pro mais antigo). */
  maxTitulos: number;
}

/**
 * As 3 edições do dia. Pra mexer nos horários ou na quantidade de notícias por
 * edição, altere aqui — o workflow e a rota se ajustam sozinhos (o workflow
 * passa o `?slot=` na hora agendada; sem slot, a rota deduz pela hora de SP).
 */
export const RESUMO_EDICOES: readonly Edicao[] = [
  {
    slug: 'manha',
    label: 'Notícias da manhã',
    horaEnvioSp: 8, // 11:00 UTC
    janelaHorasAtras: 14, // desde as 18:00 de ontem (cobre a noite/madrugada)
    maxTitulos: 5,
  },
  {
    slug: 'meio',
    label: 'Notícias do meio-dia',
    horaEnvioSp: 13, // 16:00 UTC
    janelaHorasAtras: 5, // desde as 08:00
    maxTitulos: 5,
  },
  {
    slug: 'tarde',
    label: 'Notícias da tarde',
    horaEnvioSp: 18, // 21:00 UTC
    janelaHorasAtras: 5, // desde as 13:00
    maxTitulos: 5,
  },
];

/** Forma mínima de uma notícia pra seleção na janela (colunas da tabela posts). */
export interface NoticiaResumo {
  title: string;
  published_at: string | null;
}

/** Partes do relógio de parede de `now` num fuso (sem depender do fuso da máquina). */
function partesTz(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    ano: get('year'),
    mes: get('month'),
    dia: get('day'),
    hora: get('hour'),
    minuto: get('minute'),
    segundo: get('second'),
  };
}

/**
 * Diferença (em ms) entre o relógio de parede de São Paulo e o UTC em `now`.
 * Pra SP é sempre -3h (Brasília não tem DST desde 2019), mas o cálculo via
 * Intl se mantém correto mesmo se o fuso mudar.
 */
function offsetTz(now: Date, timeZone: string): number {
  const p = partesTz(now, timeZone);
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return comoUtc - now.getTime();
}

/** Hora atual (0-23) em São Paulo — usada pra deduzir qual edição disparar. */
export function obterHoraSp(now: Date, timeZone = 'America/Sao_Paulo'): number {
  return partesTz(now, timeZone).hora;
}

/**
 * Qual edição corresponde à hora em São Paulo (fallback quando a rota não
 * recebe `?slot=`). Faixas tolerantes a atraso do cron do GitHub Actions
 * (até ~1h): um run das 11:00 UTC atrasado pra 12:00 UTC ainda cai na manhã.
 * Madrugada (00-03h) cai na manhã: a janela da manhã cobre a noite inteira.
 */
export function edicaoPorHoraSp(horaSp: number): Edicao {
  if (horaSp >= 17) return pegarEdicao('tarde');
  if (horaSp >= 12) return pegarEdicao('meio');
  return pegarEdicao('manha');
}

export function pegarEdicao(slug: EdicaoSlug): Edicao {
  const edicao = RESUMO_EDICOES.find((e) => e.slug === slug);
  if (!edicao) throw new Error(`Edição desconhecida: ${slug}`);
  return edicao;
}

/**
 * Janela [inicio, fim) de uma edição, em horário absoluto.
 *
 * O início é ancorado na hora AGENDADA da edição (não na hora do run) e o fim é
 * o mínimo entre agora e a hora agendada — assim as 3 janelas do dia se
 * encaixam exatas mesmo com atraso do cron, sem buraco e sem sobreposição
 * entre edições, e nunca considera notícia de horário futuro (ex.: teste
 * manual às 07h da edição das 08h não puxa notícia das 07h-08h).
 */
export function calcularJanela(
  edicao: Edicao,
  now: Date,
  timeZone = 'America/Sao_Paulo'
): { inicio: Date; fim: Date } {
  const offset = offsetTz(now, timeZone);
  const p = partesTz(now, timeZone);
  // Relógio de parede de São Paulo tratado como UTC, pra fazer aritmética de data.
  const paredeUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  const horaMs = 3600_000;
  let agendado = Date.UTC(p.ano, p.mes - 1, p.dia, edicao.horaEnvioSp, 0, 0);

  // Se a janela de hoje ainda nem começou, usa a ocorrência de ontem (evita
  // janela invertida: teste manual de madrugada com ?slot=tarde, ex.).
  if (agendado - edicao.janelaHorasAtras * horaMs > paredeUtc) {
    agendado -= 24 * horaMs;
  }

  const inicio = new Date(agendado - edicao.janelaHorasAtras * horaMs - offset);
  const fim = new Date(Math.min(paredeUtc, agendado) - offset);
  return { inicio, fim };
}

export function formatarDataResumo(now: Date, timeZone = 'America/Sao_Paulo'): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone,
  }).format(now);
}

/** Remove newline/tab (quebrariam a mensagem) e colapsa espaços duplicados. */
export function limparTitulo(title: string): string {
  return title.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * Filtra as notícias da janela da edição, do mais recente pro mais antigo,
 * limitado ao `maxTitulos` da edição. A janela já está limitada a horários
 * passados, então notícia futura nunca passa. Reordena por garantia (a query
 * já ordena por published_at desc).
 */
export function selecionarArtigosJanela<T extends Pick<NoticiaResumo, 'title' | 'published_at'>>(
  artigos: T[],
  janela: { inicio: Date; fim: Date },
  maxTitulos: number
): T[] {
  return artigos
    .filter((a) => {
      if (!a.published_at) return false;
      const ts = new Date(a.published_at).getTime();
      return ts >= janela.inicio.getTime() && ts < janela.fim.getTime();
    })
    .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime())
    .slice(0, maxTitulos);
}
