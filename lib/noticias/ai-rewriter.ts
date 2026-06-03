import { GoogleGenerativeAI } from '@google/generative-ai';
import type { FeedItem } from './types';
import { safeRun } from './utils';

let genAI: GoogleGenerativeAI | null = null;

function getGemini() {
  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
}

const CATEGORIAS_VALIDAS = ['Mercado', 'Tecnologia', 'Industria', 'Emprego', 'Legislacao', 'Eventos', 'Siderurgia', 'Energia'];
const REGIOES_VALIDAS = ['ES', 'MG', 'Brasil', 'Internacional'];

type RewriteResult = {
  titulo: string;
  resumo: string;
  categoria: string;
  regiao: string;
};

export async function reescreverComIA(item: FeedItem): Promise<RewriteResult> {
  return safeRun(
    async () => {
      const model = getGemini();
      const prompt = `Você é editor do Portal Metalmecânica, portal de notícias do setor industrial brasileiro.
Reescreva a notícia abaixo em português brasileiro jornalístico, focando no interesse para profissionais do setor metalmecânico.
Responda APENAS com JSON válido, sem markdown, sem explicações:
{
  "titulo": "string (máximo 90 caracteres, objetivo e informativo)",
  "resumo": "string (máximo 200 caracteres, resume o fato principal)",
  "categoria": "uma de: Mercado|Tecnologia|Industria|Emprego|Legislacao|Eventos|Siderurgia|Energia",
  "regiao": "uma de: ES|MG|Brasil|Internacional"
}

NOTÍCIA ORIGINAL:
Título: ${item.titulo}
Fonte: ${item.fonteNome}
Conteúdo: ${item.conteudo.slice(0, 600)}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const json = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(json) as RewriteResult;

      return {
        titulo: (parsed.titulo || item.titulo).slice(0, 90),
        resumo: (parsed.resumo || item.conteudo).slice(0, 200),
        categoria: CATEGORIAS_VALIDAS.includes(parsed.categoria) ? parsed.categoria : 'Mercado',
        regiao: REGIOES_VALIDAS.includes(parsed.regiao) ? parsed.regiao : 'Brasil',
      };
    },
    {
      fallback: {
        titulo: item.titulo.slice(0, 90),
        resumo: item.conteudo.slice(0, 200),
        categoria: 'Mercado',
        regiao: 'Brasil',
      },
    }
  );
}
