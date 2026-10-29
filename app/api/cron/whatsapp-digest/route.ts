import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { buildMensagensTelegram } from '@/lib/telegram/resumo';
import {
  calcularJanela,
  edicaoPorHoraSp,
  obterHoraSp,
  pegarEdicao,
  selecionarArtigosJanela,
  type EdicaoSlug,
} from '@/lib/whatsapp/resumo';

export const maxDuration = 30;

/**
 * Envia uma edição do resumo do dia pro dono do portal via bot do Telegram:
 * um cabeçalho + uma mensagem por notícia, cada uma com botão "Enviar no
 * WhatsApp" pro dono mandar pro grupo (ver lib/telegram/resumo.ts). A rota
 * mantém o nome whatsapp-digest porque o destino final é o grupo do WhatsApp.
 *
 * 3 edições por dia (manhã 08h, meio-dia 13h, tarde 18h de SP), cada uma com as
 * notícias publicadas desde a edição anterior — janelas [início, fim) que se
 * encaixam sem sobreposição (ver lib/whatsapp/resumo.ts).
 *
 * Agendado pelo GitHub Actions (.github/workflows/digesto-whatsapp.yml), que
 * passa o `?slot=` de cada horário. Sem slot (ex.: curl manual), a edição é
 * deduzida pela hora atual de São Paulo. NÃO agendar no cron-job.org também,
 * senão o resumo sai em dobro.
 */

// Folga além do maxTitulos da manhã (janela de 14h, a maior do dia): o filtro
// de relevância do pipeline descarta quase tudo, mas um dia de muita coleta
// ainda cabe — e a janela é aplicada no banco (gte), não em memória.
const BUSCA_LIMITE = 200;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token) {
    return NextResponse.json(
      { error: 'TELEGRAM_BOT_TOKEN precisa estar setado (ver docs/whatsapp-resumo-diario.md)' },
      { status: 503 }
    );
  }
  if (!chatId) {
    // Ajuda no setup: lista quem mandou /start pro bot, pra achar o chat_id.
    const updates = await telegram(token, 'getUpdates', {});
    const chats = (updates.result ?? []).flatMap((u: TelegramUpdate) =>
      u.message?.chat ? [{ id: u.message.chat.id, nome: u.message.chat.first_name ?? u.message.chat.title }] : []
    );
    return NextResponse.json(
      { error: 'TELEGRAM_CHAT_ID precisa estar setado', chatsQueMandaramStart: chats },
      { status: 503 }
    );
  }

  const agora = new Date();

  // Edição: ?slot=manha|meio|tarde do workflow, ou deduzida pela hora de SP.
  const slotParam = req.nextUrl.searchParams.get('slot');
  if (slotParam && !['manha', 'meio', 'tarde'].includes(slotParam)) {
    return NextResponse.json(
      { error: `slot inválido: ${slotParam} (use manha, meio ou tarde)` },
      { status: 400 }
    );
  }
  const edicao = slotParam
    ? pegarEdicao(slotParam as EdicaoSlug)
    : edicaoPorHoraSp(obterHoraSp(agora));

  const janela = calcularJanela(edicao, agora);

  // Filtro por data já no banco pra cobrir a janela inteira (a manhã tem 14h
  // de notícias) e published_at futuros — a janela da edição já corta tudo
  // depois do fim (horário agendado ≤ agora), mas o gte protege contra
  // corrida de relógio e limita o retorno ao que interessa.
  const { data, error } = await (await createServiceClient())
    .from('posts')
    .select('slug, title, published_at')
    .not('published_at', 'is', null)
    .gte('published_at', janela.inicio.toISOString())
    .order('published_at', { ascending: false })
    .limit(BUSCA_LIMITE);
  if (error) {
    return NextResponse.json({ error: `Supabase: ${error.message}` }, { status: 500 });
  }

  const supabase = await createServiceClient();
  const candidatas = (data ?? []) as { slug: string; title: string; published_at: string | null }[];

  // Notícias que já saíram em outra execução (disparo manual, cron atrasado).
  // Se a tabela ainda não existe (migration 023), segue sem deduplicar.
  const { data: jaEnviadas, error: erroEnviadas } = await supabase
    .from('resumo_enviados')
    .select('slug')
    .in('slug', candidatas.map((c) => c.slug));
  if (erroEnviadas) console.error('resumo_enviados:', erroEnviadas.message);
  const enviadas = new Set(((jaEnviadas ?? []) as { slug: string }[]).map((r) => r.slug));

  const selecionadas = selecionarArtigosJanela(
    candidatas.filter((c) => !enviadas.has(c.slug)),
    janela,
    edicao.maxTitulos
  );
  if (selecionadas.length === 0) {
    return NextResponse.json({
      sent: false,
      edicao: edicao.slug,
      reason: 'sem notícias novas na janela desta edição (ou todas já enviadas)',
      janela: { inicio: janela.inicio.toISOString(), fim: janela.fim.toISOString() },
    });
  }

  const mensagens = buildMensagensTelegram(edicao, selecionadas, agora);

  // Em sequência pra manter a ordem no chat (cabeçalho primeiro).
  for (const mensagem of mensagens) {
    const data = await telegram(token, 'sendMessage', {
      chat_id: chatId,
      parse_mode: 'HTML',
      ...mensagem,
    });
    if (!data.ok) {
      return NextResponse.json(
        {
          error: `Telegram: ${data.description ?? 'resposta inesperada'}`,
          telegramCode: data.error_code,
        },
        { status: 502 }
      );
    }
  }

  const { error: erroMarca } = await supabase
    .from('resumo_enviados')
    .upsert(selecionadas.map((a) => ({ slug: a.slug, edicao: edicao.slug })) as never, { onConflict: 'slug' });
  if (erroMarca) console.error('resumo_enviados (marcar):', erroMarca.message);

  return NextResponse.json({
    sent: true,
    edicao: edicao.slug,
    mensagens: mensagens.length,
    titulos: selecionadas.map((a) => a.title),
    janela: { inicio: janela.inicio.toISOString(), fim: janela.fim.toISOString() },
  });
}

interface TelegramUpdate {
  message?: { chat?: { id: number; first_name?: string; title?: string } };
}

interface TelegramResposta {
  ok: boolean;
  result?: TelegramUpdate[];
  description?: string;
  error_code?: number;
}

async function telegram(
  token: string,
  metodo: string,
  corpo: Record<string, unknown>
): Promise<TelegramResposta> {
  const response = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  return (await response.json().catch(() => ({ ok: false }))) as TelegramResposta;
}
