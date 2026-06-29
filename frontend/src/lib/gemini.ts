import { BASE_URL, backendHeaders } from "@/lib/api";

export type GeminiCallOptions = {
  system: string;
  history: Array<{ role: string; content: string }>;
  user: string;
  json?: boolean;
  maxOutputTokens?: number;
};

export type GeminiCallResult = {
  text: string;
  error?: string;
  provider?: string;
  model?: string;
};

/** Browser key is optional — prod flows use POST /api/v1/llm/generate on the backend. */
export function isGeminiConfigured(): boolean {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  const allow =
    import.meta.env.DEV || import.meta.env.VITE_ENABLE_BROWSER_LLM_FALLBACK === "true";
  return Boolean(key && allow);
}

/** Thin proxy to the backend LLM completion endpoint (no browser API key in prod). */
export async function callGemini(opts: GeminiCallOptions): Promise<GeminiCallResult> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/llm/generate`, {
      method: "POST",
      headers: backendHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        system: opts.system,
        user: opts.user,
        history: opts.history.map((h) => ({
          role: h.role === "assistant" ? "assistant" : h.role,
          content: h.content,
        })),
        json: opts.json ?? false,
        max_output_tokens: opts.maxOutputTokens ?? 4096,
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { text: "", error: `LLM proxy ${res.status}: ${detail.slice(0, 200)}` };
    }
    const body = (await res.json()) as {
      text?: string;
      error?: string | null;
      provider?: string;
      model?: string;
    };
    return {
      text: body.text ?? "",
      error: body.error ?? undefined,
      provider: body.provider,
      model: body.model,
    };
  } catch (err) {
    return { text: "", error: err instanceof Error ? err.message : String(err) };
  }
}
