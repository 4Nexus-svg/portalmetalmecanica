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
  conteudo: string;
  categoria: string;
  regiao: string;
};

export async function reescreverComIA(item: FeedItem): Promise<RewriteResult> {
  return safeRun(
    async () => {
      const model = getGemini();
      const prompt = `Você é um jornalista sênior do Portal Metalmecânica, especializado no setor industrial brasileiro (metalmecânica, siderurgia, automação, energia, mineração).

Com base na notícia abaixo, escreva uma matéria jornalística completa em português brasileiro.

NOTÍCIA ORIGINAL:
Título: ${item.titulo}
Fonte: ${item.fonteNome}
Conteúdo: ${item.conteudo.slice(0, 800)}

Responda APENAS com JSON válido, sem markdown, sem explicações:
{
  "titulo": "string (máximo 90 caracteres, objetivo e informativo, sem clickbait)",
  "resumo": "string (máximo 200 caracteres, resume o fato principal em uma frase)",
  "conteudo": "string (matéria completa em HTML com 4 a 6 parágrafos usando apenas tags <p>. Escreva como jornalista: contextualize o fato, apresente dados, explique o impacto para o setor industrial. Mínimo 300 palavras.)",
  "categoria": "uma de: Mercado|Tecnologia|Industria|Emprego|Legislacao|Eventos|Siderurgia|Energia",
  "regiao": "uma de: ES|MG|Brasil|Internacional"
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      const json = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(json) as RewriteResult;

      return {
        titulo: (parsed.titulo || item.titulo).slice(0, 90),
        resumo: (parsed.resumo || item.conteudo).slice(0, 200),
        conteudo: parsed.conteudo || `<p>${parsed.resumo || item.conteudo}</p>`,
        categoria: CATEGORIAS_VALIDAS.includes(parsed.categoria) ? parsed.categoria : 'Mercado',
        regiao: REGIOES_VALIDAS.includes(parsed.regiao) ? parsed.regiao : 'Brasil',
      };
    },
    {
      fallback: {
        titulo: item.titulo.slice(0, 90),
        resumo: item.conteudo.slice(0, 200),
        conteudo: `<p>${item.conteudo.slice(0, 200)}</p>`,
        categoria: 'Mercado',
        regiao: 'Brasil',
      },
    }
  );
}
