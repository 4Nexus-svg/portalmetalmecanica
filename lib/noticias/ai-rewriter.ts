import { generateText } from './ai-provider';
import type { FeedItem } from './types';
import { safeRun } from './utils';

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
  const contexto = `Título: ${item.titulo}\nFonte: ${item.fonteNome}\nConteúdo: ${item.conteudo.slice(0, 800)}`;

  // ── Chamada 1: metadados (JSON) ───────────────────────────────────────────
  const metadados = await safeRun(
    async () => {
      const prompt = `Você é editor do Portal Metalmecânica, portal de notícias industriais do Brasil.
Analise a notícia abaixo e responda APENAS com JSON válido (sem markdown, sem explicações):
{"titulo":"string (máx 90 chars, objetivo)","resumo":"string (máx 200 chars, 1 frase)","categoria":"Mercado|Tecnologia|Industria|Emprego|Legislacao|Eventos|Siderurgia|Energia","regiao":"ES|MG|Brasil|Internacional"}

NOTÍCIA:
${contexto}`;

      const text = await generateText(prompt);
      const json = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
      return JSON.parse(json) as { titulo: string; resumo: string; categoria: string; regiao: string };
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

  // ── Chamada 2: artigo completo (HTML direto) ──────────────────────────────
  const conteudo = await safeRun(
    async () => {
      const prompt = `Você é um jornalista sênior do Portal Metalmecânica, especializado no setor industrial brasileiro (metalmecânica, siderurgia, automação, energia, mineração, petróleo).

Escreva uma matéria jornalística COMPLETA sobre a notícia abaixo. Use linguagem profissional e objetiva.

INSTRUÇÕES:
- Escreva entre 5 e 7 parágrafos usando APENAS tags <p>
- Contextualize o fato para profissionais do setor
- Mencione impactos econômicos, dados relevantes e perspectivas do mercado
- Mínimo absoluto: 350 palavras
- NÃO use outros elementos HTML além de <p>
- Responda APENAS com o HTML dos parágrafos, sem explicações, sem título

NOTÍCIA:
${contexto}`;

      const html = await generateText(prompt);
      const clean = html.replace(/^```html?\s*/i, '').replace(/\s*```$/i, '').trim();
      return clean.startsWith('<p>') ? clean : `<p>${clean}</p>`;
    },
    {
      timeout: 60000,
      tentativas: 1,
      fallback: `<p>${metadados.resumo}</p>`,
    }
  );

  return {
    titulo: (metadados.titulo || item.titulo).slice(0, 90),
    resumo: (metadados.resumo || item.conteudo).slice(0, 200),
    conteudo,
    categoria: CATEGORIAS_VALIDAS.includes(metadados.categoria) ? metadados.categoria : 'Mercado',
    regiao: REGIOES_VALIDAS.includes(metadados.regiao) ? metadados.regiao : 'Brasil',
  };
}
