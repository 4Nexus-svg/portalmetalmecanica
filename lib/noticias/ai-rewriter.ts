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
  // Sem fallback: se todos os provedores de IA falharem aqui, é melhor abortar
  // a publicação (pipeline tenta de novo no próximo cron) do que publicar
  // título cru truncado/lixo de RSS ("The post X appeared first on Y...").
  // tentativas:1 porque generateText() já percorre Gemini→Groq→OpenRouter
  // internamente — repetir isso 3x (default do safeRun) só triplica o consumo
  // de cota sem chance real de sucesso diferente.
  let metadados: { titulo: string; resumo: string; categoria: string; regiao: string };
  try {
    metadados = await safeRun(
      async () => {
        const prompt = `Você é editor do Portal Metalmecânica, portal de notícias industriais do Brasil.
Analise a notícia abaixo e responda APENAS com JSON válido (sem markdown, sem explicações):
{"titulo":"string (máx 90 chars, objetivo)","resumo":"string (máx 200 chars, 1 frase)","categoria":"Mercado|Tecnologia|Industria|Emprego|Legislacao|Eventos|Siderurgia|Energia","regiao":"ES|MG|Brasil|Internacional"}
Use Legislacao para notícias sobre NRs, normas, regulamentações, segurança do trabalho, EPI, CIPA, acidentes.

NOTÍCIA:
${contexto}`;

        const text = await generateText(prompt);
        const json = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
        return JSON.parse(json) as { titulo: string; resumo: string; categoria: string; regiao: string };
      },
      { tentativas: 1, timeout: 45000 }
    );
  } catch {
    throw new Error(`IA indisponível (todos os provedores falharam) para: ${item.titulo}`);
  }

  // ── Chamada 2: artigo completo (HTML direto) ──────────────────────────────
  // Também sem fallback: publicar um artigo de 1 frase (só o resumo) é
  // enganoso pro leitor. Se a IA falhar aqui, aborta e deixa o cron tentar
  // de novo depois (tentativas:2 com pequeno atraso já ajuda em falhas
  // passageiras de rate-limit por concorrência).
  let conteudo: string;
  try {
    conteudo = await safeRun(
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
      { timeout: 60000, tentativas: 2, delayBase: 5000 }
    );
  } catch {
    throw new Error(`IA indisponível (artigo completo) para: ${item.titulo}`);
  }

  return {
    titulo: (metadados.titulo || item.titulo).slice(0, 90),
    resumo: (metadados.resumo || item.conteudo).slice(0, 200),
    conteudo,
    categoria: CATEGORIAS_VALIDAS.includes(metadados.categoria) ? metadados.categoria : 'Mercado',
    regiao: REGIOES_VALIDAS.includes(metadados.regiao) ? metadados.regiao : 'Brasil',
  };
}

export async function reescreverMultiFonte(itens: FeedItem[]): Promise<RewriteResult> {
  const fontesList = itens.map((i) => i.fonteNome).join(', ');
  const contextoFontes = itens
    .map((i, idx) =>
      `--- Fonte ${idx + 1}: ${i.fonteNome} ---\nTítulo: ${i.titulo}\nConteúdo: ${i.conteudo.slice(0, 600)}`
    )
    .join('\n\n');

  let metadados: { titulo: string; resumo: string; categoria: string; regiao: string };
  try {
    metadados = await safeRun(
      async () => {
        const prompt = `Você é editor do Portal Metalmecânica, portal de notícias industriais do Brasil.
As ${itens.length} fontes abaixo cobrem o MESMO evento. Crie metadados para uma matéria unificada.
Responda APENAS com JSON válido (sem markdown):
{"titulo":"string (máx 90 chars, mais completo que qualquer fonte individual)","resumo":"string (máx 200 chars, 1 frase que una as perspectivas)","categoria":"Mercado|Tecnologia|Industria|Emprego|Legislacao|Eventos|Siderurgia|Energia","regiao":"ES|MG|Brasil|Internacional"}

${contextoFontes}`;

        const text = await generateText(prompt);
        const json = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
        return JSON.parse(json) as { titulo: string; resumo: string; categoria: string; regiao: string };
      },
      { tentativas: 1, timeout: 45000 }
    );
  } catch {
    throw new Error(`IA indisponível (todos os provedores falharam) para: ${itens[0].titulo}`);
  }

  let conteudo: string;
  try {
    conteudo = await safeRun(
      async () => {
        const prompt = `Você é um jornalista sênior do Portal Metalmecânica, especializado no setor industrial brasileiro.

As ${itens.length} fontes abaixo cobrem o MESMO evento de perspectivas complementares: ${fontesList}.

Escreva uma matéria jornalística ORIGINAL unindo as informações das fontes. REGRAS:
- Entre 200 e 400 palavras no total
- Use APENAS tags <p>
- NÃO copie trechos das fontes — reescreva completamente com suas palavras
- Contextualize o fato para profissionais do setor metalmecânico
- No último parágrafo, cite as fontes assim: <p><em>Fontes: ${fontesList}.</em></p>
- Responda APENAS com o HTML dos parágrafos, sem título, sem explicações

${contextoFontes}`;

        const html = await generateText(prompt);
        const clean = html.replace(/^```html?\s*/i, '').replace(/\s*```$/i, '').trim();
        return clean.startsWith('<p>') ? clean : `<p>${clean}</p>`;
      },
      { timeout: 60000, tentativas: 2, delayBase: 5000 }
    );
  } catch {
    throw new Error(`IA indisponível (artigo completo) para: ${itens[0].titulo}`);
  }

  return {
    titulo: (metadados.titulo || itens[0].titulo).slice(0, 90),
    resumo: (metadados.resumo || itens[0].conteudo).slice(0, 200),
    conteudo,
    categoria: CATEGORIAS_VALIDAS.includes(metadados.categoria) ? metadados.categoria : 'Mercado',
    regiao: REGIOES_VALIDAS.includes(metadados.regiao) ? metadados.regiao : 'Brasil',
  };
}
