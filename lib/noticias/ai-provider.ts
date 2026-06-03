import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_MODEL     = process.env.GEMINI_MODEL     ?? 'gemini-2.5-flash-lite';
const GROQ_MODEL       = process.env.GROQ_MODEL       ?? 'llama-3.3-70b-versatile';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL ?? 'meta-llama/llama-3.3-70b-instruct:free';

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

async function callOpenAICompat(
  url: string,
  key: string,
  model: string,
  prompt: string,
  nome: string
): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${nome} ${res.status}: ${body}`);
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[];
  };

  return data.choices[0]?.message?.content?.trim() ?? '';
}

async function callGroq(prompt: string): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY não configurada');
  return callOpenAICompat('https://api.groq.com/openai/v1/chat/completions', key, GROQ_MODEL, prompt, 'Groq');
}

async function callOpenRouter(prompt: string): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY não configurada');
  return callOpenAICompat('https://openrouter.ai/api/v1/chat/completions', key, OPENROUTER_MODEL, prompt, 'OpenRouter');
}

export async function generateText(prompt: string): Promise<string> {
  // 1. Gemini (primário)
  try {
    return await callGemini(prompt);
  } catch (err) {
    if (!deveUsarFallback(err)) throw err;
    console.warn(`[ai-provider] Gemini falhou, tentando Groq...`);
  }

  // 2. Groq (primeiro fallback)
  try {
    return await callGroq(prompt);
  } catch (err) {
    if (!deveUsarFallback(err)) throw err;
    console.warn(`[ai-provider] Groq falhou, tentando OpenRouter...`);
  }

  // 3. OpenRouter (segundo fallback)
  return await callOpenRouter(prompt);
}
