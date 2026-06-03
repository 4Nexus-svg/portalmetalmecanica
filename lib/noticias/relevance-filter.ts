import { GoogleGenerativeAI } from '@google/generative-ai';
import type { FeedItem } from './types';
import { safeRun } from './utils';

// ─── Camada 1: Score rápido por keywords ─────────────────────────────────────
const PESOS: [string, number][] = [
  ['metalmecânica', 4],
  ['metalurgia', 3],
  ['siderurgia', 3],
  ['usiminas', 2],
  ['vallourec', 2],
  ['csn', 2],
  ['abimaq', 2],
  ['aço', 2],
  ['indústria metal', 2],
  ['automação industrial', 2],
  ['confab', 1],
  ['fornos industriais', 1],
  ['mercado industrial', 1],
  ['exportação aço', 1],
  ['mineração', 1],
  ['siderúrgica', 1],
  ['laminação', 1],
  ['fundição', 1],
];

export function scoreRapido(titulo: string): number {
  const lower = titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let score = 0;
  for (const [palavra, peso] of PESOS) {
    const norm = palavra.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (lower.includes(norm)) score += peso;
  }
  return score;
}

// ─── Camada 2: Filtro IA via Gemini ──────────────────────────────────────────
let genAI: GoogleGenerativeAI | null = null;

function getGemini() {
  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
}

type FiltroIAResult = {
  relevante: boolean;
  score: number;
  tipo: string;
};

export async function filtrarRelevanciaIA(item: FeedItem): Promise<FiltroIAResult> {
  return safeRun(
    async () => {
      const model = getGemini();
      const prompt = `Você é um filtro de notícias do setor metalmecânico brasileiro.
Avalie se a notícia abaixo é relevante para profissionais do setor metal-mecânico, siderurgia, metalurgia, automação industrial ou indústria pesada no Brasil.
Responda APENAS com JSON válido, sem markdown, sem explicações:
{"relevante": boolean, "score": number, "tipo": "mercado|produto|empresa|regulatorio|tecnologia|irrelevante"}
onde score é um número de 0 a 1.

NOTÍCIA:
Título: ${item.titulo}
Conteúdo: ${item.conteudo.slice(0, 400)}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const json = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(json) as FiltroIAResult;
    },
    { fallback: { relevante: true, score: 0.5, tipo: 'mercado' } }
  );
}

export function aplicarScoreRapidoEOrdenar(items: FeedItem[]): Array<FeedItem & { score: number }> {
  return items
    .map(item => ({ ...item, score: scoreRapido(item.titulo) }))
    .filter(item => item.score >= 1)
    .sort((a, b) => b.score - a.score);
}
