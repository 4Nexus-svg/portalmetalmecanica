export type TipoFonte = 'api' | 'rss-geral' | 'rss-dedicado' | 'historico';

export type FeedItem = {
  titulo: string;
  url: string;
  conteudo: string;
  publicadoEm: Date;
  imagemUrl?: string;
  fonteNome: string;
  tipoFonte: TipoFonte;
};

export type ItemComScore = FeedItem & { score: number };

export type ItemProcessado = FeedItem & {
  tituloFinal: string;
  resumoFinal: string;
  categoria: string;
  regiao: string;
  imagemFinal: string | null;
};

export type ResultadoPipeline = {
  inseridas: number;
  duplicadas: number;
  irrelevantes: number;
  erros: number;
  abortado: boolean;
  feedStats: Record<string, number>;
};
