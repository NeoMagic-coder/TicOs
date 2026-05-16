// Minimal Gemini client for OneProduct Agent OS.
// Key & model come from Vite env (VITE_GEMINI_API_KEY / VITE_GEMINI_MODEL).
// NOTE: Browser-side key — fine for local prototype, NOT for production.

const API_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) ?? '';
const MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) ?? 'gemini-2.5-flash';

export function isGeminiConfigured(): boolean {
  return API_KEY.length > 0;
}

export interface GeminiCallResult {
  text: string;
  error?: string;
}

interface GeminiPart { text: string }
interface GeminiContent { role: 'user' | 'model'; parts: GeminiPart[] }

export async function callGemini(opts: {
  system: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  user: string;
}): Promise<GeminiCallResult> {
  if (!API_KEY) {
    return { text: '', error: 'Gemini API key bulunamadı (VITE_GEMINI_API_KEY).' };
  }

  const contents: GeminiContent[] = [
    ...opts.history.map((m) => ({
      role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: opts.user }] },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { role: 'system', parts: [{ text: opts.system }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { text: '', error: `Gemini hata ${res.status}: ${body.slice(0, 200)}` };
    }

    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts
      ?.map((p: GeminiPart) => p.text ?? '')
      .join('')
      .trim();

    if (!text) {
      const finish = data?.candidates?.[0]?.finishReason;
      return { text: '', error: `Yanıt boş (finishReason: ${finish ?? 'unknown'})` };
    }

    return { text };
  } catch (err) {
    return { text: '', error: `Ağ hatası: ${err instanceof Error ? err.message : String(err)}` };
  }
}
