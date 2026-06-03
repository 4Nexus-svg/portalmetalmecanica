import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite';
const GROQ_MODEL   = process.env.GROQ_MODEL   ?? 'llama-3.3-70b-versatile';

function deveUsarFallback(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('429') ||       // quota excedida
    msg.includes('503') ||       // serviço indisponível
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('Too Many') ||
    msg.includes('Service Unavailable') ||
    msg.includes('not found') ||  // modelo descontinuado
    msg.includes('404')
  );
}

async function callGemini(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY não configurada');

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

async function callGroq(prompt: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY não configurada');

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Groq ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[];
  };

  return data.choices[0]?.message?.content?.trim() ?? '';
}

export async function generateText(prompt: string): Promise<string> {
  try {
    return await callGemini(prompt);
  } catch (err) {
    if (deveUsarFallback(err)) {
      console.warn(`[ai-provider] Gemini falhou (${err instanceof Error ? err.message.slice(0, 80) : err}), usando Groq...`);
      return await callGroq(prompt);
    }
    throw err;
  }
}
