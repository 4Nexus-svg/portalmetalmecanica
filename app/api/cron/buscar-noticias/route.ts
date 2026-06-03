import { NextRequest, NextResponse } from 'next/server';
import { fetchFeeds } from '@/lib/noticias/feed-fetcher';
import { aplicarScoreRapidoEOrdenar, filtrarRelevanciaIA } from '@/lib/noticias/relevance-filter';
import { reescreverComIA } from '@/lib/noticias/ai-rewriter';
import { resolverImagem } from '@/lib/noticias/image-sourcer';
import {
  buscarExistentes,
  ehDuplicata,
  marcarVisto,
  publicarNoticia,
} from '@/lib/noticias/publisher';
import { processarComConcorrencia } from '@/lib/noticias/utils';
import type { ResultadoPipeline } from '@/lib/noticias/types';
import { extrairEPublicarEventos } from '@/lib/noticias/event-extractor';

const MAX_INSERCOES = 30;
const MAX_ERROS_CONSECUTIVOS = 10;

function isAutorizado(req: NextRequest): boolean {
  return (
    req.headers.get('x-vercel-cron') === '1' ||
    req.nextUrl.searchParams.get('secret') === process.env.CRON_SECRET
  );
}

export async function GET(req: NextRequest) {
  if (!isAutorizado(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const modo = req.nextUrl.searchParams.get('modo') ?? 'todos';
  const dry = req.nextUrl.searchParams.get('dry') === 'true';

  const resultado: ResultadoPipeline = {
    inseridas: 0,
    duplicadas: 0,
    irrelevantes: 0,
    erros: 0,
    abortado: false,
    feedStats: {},
  };

  try {
    // Etapa 1: Coleta
    const { items, feedStats } = await fetchFeeds(modo);
    resultado.feedStats = feedStats;

    if (items.length === 0) {
      return NextResponse.json({ ...resultado, msg: 'Nenhum item coletado' });
    }

    // Etapa 2+3: Score rápido + filtro data (já aplicados no fetchFeeds)
    const comScore = aplicarScoreRapidoEOrdenar(items);

    // Etapa 4: Buscar existentes no banco (deduplicação cross-execução)
    const existentes = await buscarExistentes();
    const linksSeen = new Set<string>();
    const titulosSeen = new Set<string>();

    let errosConsecutivos = 0;

    // Etapa 5: Processar com concorrência 3
    await processarComConcorrencia(
      comScore,
      async (item) => {
        if (resultado.inseridas >= MAX_INSERCOES || resultado.abortado) return;

        try {
          // Deduplicação
          if (ehDuplicata(item, existentes, linksSeen, titulosSeen)) {
            resultado.duplicadas++;
            return;
          }

          // Filtro IA (Gemini)
          const filtro = await filtrarRelevanciaIA(item);
          if (!filtro.relevante || filtro.score < 0.4) {
            resultado.irrelevantes++;
            return;
          }

          // Reescrita com IA
          const rewrite = await reescreverComIA(item);

          // Imagem com fallback
          const imagemFinal = await resolverImagem(item);

          // Publicar (ou apenas simular em dry run)
          if (!dry) {
            await publicarNoticia({
              ...item,
              tituloFinal: rewrite.titulo,
              resumoFinal: rewrite.resumo,
              conteudoFinal: rewrite.conteudo,
              categoria: rewrite.categoria,
              regiao: rewrite.regiao,
              imagemFinal,
            });
          }

          marcarVisto(item, linksSeen, titulosSeen);
          resultado.inseridas++;
          errosConsecutivos = 0;
        } catch {
          resultado.erros++;
          errosConsecutivos++;
          if (errosConsecutivos >= MAX_ERROS_CONSECUTIVOS) {
            resultado.abortado = true;
          }
        }
      },
      3
    );
    // Extração de eventos das notícias coletadas
    if (!dry) {
      const eventosInseridos = await extrairEPublicarEventos(comScore);
      if (eventosInseridos > 0) {
        (resultado as typeof resultado & { eventos?: number }).eventos = eventosInseridos;
      }
    }
  } catch (err) {
    return NextResponse.json(
      { ...resultado, error: err instanceof Error ? err.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ...resultado, dry });
}
