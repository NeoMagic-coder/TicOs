/**
 * Browser-side Gemini access goes through the backend proxy so API keys
 * never ship in the Vite bundle.
 */

import { BASE_URL, backendHeaders } from '@/lib/api';

export interface GeminiCallOptions {
  system?: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  user: string;
  json?: boolean;
  maxOutputTokens?: number;
}

export function isGeminiConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_GEMINI_API_KEY ||
      import.meta.env.VITE_ENABLE_BROWSER_LLM_FALLBACK ||
      import.meta.env.DEV,
  );
}

export async function callGemini(
  opts: GeminiCallOptions,
): Promise<{ text: string; error?: string }> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/llm/generate`, {
      method: 'POST',
      headers: { ...backendHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: opts.system || '',
        history: opts.history || [],
        user: opts.user,
        json: opts.json ?? false,
        max_output_tokens: opts.maxOutputTokens ?? 4096,
      }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { text: '', error: detail || `HTTP ${res.status}` };
    }
    const data = await res.json();
    const text = typeof data?.text === 'string' ? data.text : typeof data?.content === 'string' ? data.content : '';
    return { text };
  } catch (err) {
    return { text: '', error: err instanceof Error ? err.message : String(err) };
  }
}
