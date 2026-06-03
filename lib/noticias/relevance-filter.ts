import { GoogleGenerativeAI } from '@google/generative-ai';
import type { FeedItem } from './types';
import { safeRun } from './utils';

// ─── Camada 1: Score rápido por keywords ─────────────────────────────────────
const PESOS: [string, number][] = [
  // Setor metalmecânico — alta relevância
  ['metalmecânica', 4],
  ['metalurgia', 3],
  ['siderurgia', 3],
  ['usiminas', 3],
  ['vallourec', 3],
  ['csn', 2],
  ['abimaq', 2],
  ['aço', 2],
  ['indústria metal', 2],
  ['automação industrial', 2],
  ['confab', 2],
  ['siderúrgica', 2],
  ['laminação', 2],
  ['fundição', 2],
  ['mineração', 1],
  ['exportação aço', 1],
  ['fornos industriais', 1],
  // Espírito Santo — canal ES
  ['espírito santo', 3],
  ['vitória es', 2],
  ['serra es', 2],
  ['cariacica', 2],
  ['vale espírito', 2],
  ['portos es', 2],
  ['findes', 2],
  ['gazeta online', 1],
  // Minas Gerais — canal MG
  ['minas gerais', 3],
  ['ipatinga', 3],
  ['betim', 2],
  ['contagem', 2],
  ['fiemg', 2],
  ['vale minas', 2],
  ['belo horizonte indústria', 1],
  // Tecnologia industrial
  ['indústria 4.0', 3],
  ['robótica industrial', 2],
  ['iot industrial', 2],
  ['manufatura inteligente', 2],
  ['cobô', 2],
  ['impressão 3d industrial', 1],
  // Sustentabilidade / Energia
  ['energia renovável', 3],
  ['eficiência energética', 3],
  ['descarbonização', 3],
  ['hidrogênio verde', 2],
  ['biomassa industrial', 2],
  ['solar indústria', 2],
  ['aneel', 1],
  // Segurança do Trabalho
  ['nr-12', 4],
  ['nr-10', 3],
  ['nr-35', 2],
  ['segurança trabalho', 3],
  ['acidente trabalho', 2],
  ['epi industrial', 2],
  ['cipa', 2],
  ['pcmso', 2],
  ['ppra', 2],
  // Petróleo & Gás
  ['petrobras', 4],
  ['petróleo gás brasil', 3],
  ['pré-sal', 2],
  ['refinaria', 2],
  ['offshore industrial', 2],
  // Economia industrial
  ['pib indústria', 2],
  ['investimento industrial', 2],
  ['exportação industrial', 2],
  ['câmbio indústria', 1],
];

export function scoreRapido(titulo: string, conteudo = ''): number {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const texto = norm(titulo + ' ' + conteudo.slice(0, 300));
  let score = 0;
  for (const [palavra, peso] of PESOS) {
    if (texto.includes(norm(palavra))) score += peso;
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
      const prompt = `Você é um filtro de notícias do Portal Metalmecânica — portal industrial do ES e MG.
Avalie se a notícia é relevante para qualquer um destes temas:
1. Metalmecânica, siderurgia, metalurgia, aço, fundição, usinagem
2. Automação industrial, robótica, indústria 4.0, manufatura
3. Indústria no Espírito Santo ou Minas Gerais (qualquer setor)
4. Energia renovável, eficiência energética, sustentabilidade industrial
5. Segurança do trabalho industrial, NRs, EPI, acidentes industriais
6. Economia industrial brasileira, investimentos, exportações do setor
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
    .map(item => ({ ...item, score: scoreRapido(item.titulo, item.conteudo) }))
    .filter(item => item.score >= 1)
    .sort((a, b) => b.score - a.score);
}
