import { createClient } from '@supabase/supabase-js';
import { generateText } from './ai-provider';
import { slugifyTitulo } from './utils';
import type { FeedItem } from './types';

type EventoExtraido = {
  title: string;
  description: string;
  type: 'feira' | 'congresso' | 'seminario' | 'workshop' | 'treinamento';
  date_start: string;
  date_end: string | null;
  city: string | null;
  state: 'ES' | 'MG' | 'Brasil' | 'Internacional' | null;
  organizer: string | null;
};

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function extrairEventoDaNoticia(item: FeedItem): Promise<EventoExtraido | null> {
  const prompt = `Analise a notícia abaixo e verifique se ela menciona um evento futuro (feira, congresso, seminário, workshop ou treinamento) do setor industrial brasileiro.

Se NÃO houver evento futuro mencionado, responda apenas: null

Se houver um evento futuro, responda com JSON válido:
{
  "title": "nome do evento",
  "description": "descrição em 1-2 frases",
  "type": "feira|congresso|seminario|workshop|treinamento",
  "date_start": "YYYY-MM-DD",
  "date_end": "YYYY-MM-DD ou null",
  "city": "cidade ou null",
  "state": "ES|MG|Brasil|Internacional ou null",
  "organizer": "organizador ou null"
}

NOTÍCIA:
Título: ${item.titulo}
Conteúdo: ${item.conteudo.slice(0, 600)}`;

  try {
    const text = await generateText(prompt);
    const trimmed = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
    if (trimmed === 'null' || trimmed === '' || !trimmed.startsWith('{')) return null;
    return JSON.parse(trimmed) as EventoExtraido;
  } catch {
    return null;
  }
}

export async function extrairEPublicarEventos(items: FeedItem[]): Promise<number> {
  const supabase = getServiceClient();
  let inseridos = 0;

  // Só analisa itens com palavras que sugerem evento
  const keywords = ['feira', 'congresso', 'seminário', 'workshop', 'treinamento', 'evento', 'conferência', 'simpósio', 'fórum'];
  const candidatos = items.filter(item => {
    const texto = (item.titulo + ' ' + item.conteudo).toLowerCase();
    return keywords.some(k => texto.includes(k));
  }).slice(0, 5); // máx 5 por execução para economizar cota

  for (const item of candidatos) {
    const evento = await extrairEventoDaNoticia(item);
    if (!evento || !evento.date_start) continue;

    // Ignora eventos passados
    if (new Date(evento.date_start) < new Date()) continue;

    const slug = slugifyTitulo(evento.title);

    const { error } = await supabase.from('events').insert({
      slug,
      title: evento.title,
      description: evento.description,
      type: evento.type,
      date_start: evento.date_start,
      date_end: evento.date_end,
      city: evento.city,
      state: evento.state,
      organizer: evento.organizer,
      is_auto: true,
    }).select('id').single();

    // Ignora erro de slug duplicado (evento já existe)
    if (!error) inseridos++;
  }

  return inseridos;
}
