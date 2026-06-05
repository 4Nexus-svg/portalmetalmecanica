import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get('secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const geminiKey = process.env.GEMINI_API_KEY ?? '';
  const orKey = process.env.OPENROUTER_API_KEY ?? '';
  const groqKey = process.env.GROQ_API_KEY ?? '';

  // Testa OpenRouter diretamente
  let orStatus = 'não testado';
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${orKey}` },
      body: JSON.stringify({ model: 'openai/gpt-oss-120b:free', messages: [{ role: 'user', content: 'ok' }], max_tokens: 5 }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json() as { choices?: unknown[]; error?: { message: string } };
    orStatus = res.ok ? `OK (${res.status}) choices=${JSON.stringify(body.choices)}` : `ERRO ${res.status}: ${body.error?.message}`;
  } catch (e) { orStatus = `EXCEPTION: ${String(e)}`; }

  // Testa Gemini
  let geminiStatus = 'não testado';
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'ok' }] }] }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await res.json() as { candidates?: unknown[]; error?: { message: string } };
    geminiStatus = res.ok ? `OK (${res.status})` : `ERRO ${res.status}: ${body.error?.message}`;
  } catch (e) { geminiStatus = `EXCEPTION: ${String(e)}`; }

  return NextResponse.json({
    gemini_key_length: geminiKey.length,
    or_key_length: orKey.length,
    groq_key_length: groqKey.length,
    gemini: geminiStatus,
    openrouter: orStatus,
  });
}
