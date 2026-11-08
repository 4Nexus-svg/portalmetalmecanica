import { generateText } from './ai-provider';
import type { FeedItem } from './types';
import { safeRun } from './utils';

const CATEGORIAS_VALIDAS = ['Mercado', 'Tecnologia', 'Industria', 'Emprego', 'Legislacao', 'Eventos', 'Siderurgia', 'Energia'];
const REGIOES_VALIDAS = ['ES', 'MG', 'Brasil', 'Internacional'];


// ── Fidelidade à fonte ───────────────────────────────────────────────────────
// Incidente 2026-11-07: a Fundacentro pediu retirada de matéria cujo texto
// (gerado com "mín. 350 palavras" a partir de 1 frase de fonte) continha
// números e fatos inventados, atribuídos à Fundacentro. Regras abaixo existem
// para impedir isso: a IA só pode usar o que está na fonte.
const REGRAS_FIDELIDADE = `REGRAS DE FIDELIDADE (obrigatórias, acima de qualquer meta de tamanho):
- Use SOMENTE fatos, nomes, cargos, datas, números, percentuais e citações que estejam EXPLICITAMENTE no texto da fonte.
- É PROIBIDO inventar ou estimar dados, estatísticas, valores, declarações, aspas, nomes de pessoas/empresas ou detalhes de eventos.
- Se a fonte tiver pouca informação, escreva uma matéria CURTA (2 a 3 parágrafos). Não complete com suposições, "contexto geral do setor" nem números externos.
- Não atribua à fonte nada que ela não disse.`;

function numerosDe(t: string): Set<string> {
  const texto = t.replace(/<[^>]+>/g, ' ');
  const out = new Set<string>();
  for (const m of texto.matchAll(/\d[\d.,]*/g)) {
    const n = m[0].replace(/[.,]+$/, '').replace(/[.,]/g, '');
    if (n) out.add(n);
  }
  return out;
}

// Retorna os números do texto gerado que NÃO aparecem na fonte (indício de invenção).
export function numerosNaoSuportados(gerado: string, fonte: string): string[] {
  const base = numerosDe(fonte);
  return [...numerosDe(gerado)].filter((n) => !base.has(n));
}

type RewriteResult = {
  titulo: string;
  resumo: string;
  conteudo: string;
  categoria: string;
  regiao: string;
};

export async function reescreverComIA(item: FeedItem): Promise<RewriteResult> {
  const contexto = `Título: ${item.titulo}\nFonte: ${item.fonteNome}\nConteúdo: ${item.conteudo.slice(0, 4000)}`;

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

Escreva uma matéria jornalística sobre a notícia abaixo, com linguagem profissional e objetiva.

${REGRAS_FIDELIDADE}

INSTRUÇÕES:
- Tamanho proporcional à fonte: no máximo 3x o tamanho do texto original; entre 2 e 6 parágrafos usando APENAS tags <p>
- Pode contextualizar de forma genérica e qualitativa, SEM números, datas ou fatos que não estejam na fonte
- NÃO use outros elementos HTML além de <p>
- Responda APENAS com o HTML dos parágrafos, sem explicações, sem título

NOTÍCIA:
${contexto}`;

        const html = await generateText(prompt);
        const clean = html.replace(/^```html?\s*/i, '').replace(/\s*```$/i, '').trim();
        const invent = numerosNaoSuportados(clean, `${item.titulo} ${item.conteudo}`);
        if (invent.length) throw new Error(`Números ausentes da fonte: ${invent.join(', ')}`);
        return clean.startsWith('<p>') ? clean : `<p>${clean}</p>`;
      },
      { timeout: 60000, tentativas: 2, delayBase: 5000 }
    );
  } catch {
    throw new Error(`IA indisponível ou texto não fiel à fonte (artigo completo) para: ${item.titulo}`);
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
      `--- Fonte ${idx + 1}: ${i.fonteNome} ---\nTítulo: ${i.titulo}\nConteúdo: ${i.conteudo.slice(0, 2500)}`
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

${REGRAS_FIDELIDADE}

Escreva uma matéria jornalística ORIGINAL unindo as informações das fontes. REGRAS:
- Até 400 palavras (menos se as fontes forem curtas)
- Use APENAS tags <p>
- NÃO copie trechos das fontes — reescreva completamente com suas palavras
- Contextualize o fato para profissionais do setor metalmecânico
- No último parágrafo, cite as fontes assim: <p><em>Fontes: ${fontesList}.</em></p>
- Responda APENAS com o HTML dos parágrafos, sem título, sem explicações

${contextoFontes}`;

        const html = await generateText(prompt);
        const clean = html.replace(/^```html?\s*/i, '').replace(/\s*```$/i, '').trim();
        const base = itens.map((i) => `${i.titulo} ${i.conteudo}`).join(' ');
        const invent = numerosNaoSuportados(clean.replace(/Fontes:[^<]*/i, ''), base);
        if (invent.length) throw new Error(`Números ausentes das fontes: ${invent.join(', ')}`);
        return clean.startsWith('<p>') ? clean : `<p>${clean}</p>`;
      },
      { timeout: 60000, tentativas: 2, delayBase: 5000 }
    );
  } catch {
    throw new Error(`IA indisponível ou texto não fiel às fontes (artigo completo) para: ${itens[0].titulo}`);
  }

  return {
    titulo: (metadados.titulo || itens[0].titulo).slice(0, 90),
    resumo: (metadados.resumo || itens[0].conteudo).slice(0, 200),
    conteudo,
    categoria: CATEGORIAS_VALIDAS.includes(metadados.categoria) ? metadados.categoria : 'Mercado',
    regiao: REGIOES_VALIDAS.includes(metadados.regiao) ? metadados.regiao : 'Brasil',
  };
}
