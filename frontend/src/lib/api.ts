/**
 * Frontend ↔ FastAPI client.
 * Buffered chat: POST /api/v1/chat
 * SSE chat:      POST /api/v1/chat/stream  (see streamChatBackend)
 */

export const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ||
  (import.meta.env.DEV ? "" : "http://localhost:8000");

export type ChatBackendResponse = {
  content: string;
  task_id: string | null;
  confidence: number;
  tools_used: string[];
  thinking: string | null;
  agent_outputs: Array<Record<string, unknown>>;
  llm_degraded?: boolean;
  llm_degraded_reason?: string | null;
};

export type ChatPayload = {
  message: string;
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  product_context?: Record<string, unknown> | null;
  language?: string;
};

export type ChatStreamEvent =
  | ({ kind: "progress" } & Record<string, unknown> & { event: string })
  | { kind: "message"; payload: ChatBackendResponse }
  | { kind: "error"; error: string };

export function backendHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json", ...extra };
  const key = import.meta.env.VITE_API_KEY as string | undefined;
  if (key) headers["X-API-Key"] = key;
  return headers;
}

export function resolveBackendUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return pathOrUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = BASE_URL.replace(/\/$/, "");
  const path = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return base ? `${base}${path}` : path;
}

export async function backendReachable(timeoutMs = 4000): Promise<boolean> {
  try {
    const res = await fetch(resolveBackendUrl("/health"), {
      headers: backendHeaders(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean };
    return body.ok !== false;
  } catch {
    return false;
  }
}

export async function chatBackend(payload: ChatPayload): Promise<ChatBackendResponse> {
  const res = await fetch(resolveBackendUrl("/api/v1/chat"), {
    method: "POST",
    headers: backendHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      message: payload.message,
      history: payload.history,
      product_context: payload.product_context ?? null,
      language: payload.language ?? "tr",
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`chat ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  return (await res.json()) as ChatBackendResponse;
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split("\n").filter(Boolean);
  let event = "message";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  return { event, data: dataLines.join("\n") };
}

/** Async iterator over Hermes SSE frames from POST /api/v1/chat/stream. */
export async function* streamChatBackend(
  payload: ChatPayload
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const res = await fetch(resolveBackendUrl("/api/v1/chat/stream"), {
    method: "POST",
    headers: backendHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      message: payload.message,
      history: payload.history,
      product_context: payload.product_context ?? null,
      language: payload.language ?? "tr",
    }),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`stream ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const frame = parseSseBlock(part);
      if (!frame) continue;
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(frame.data) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (frame.event === "message") {
        yield { kind: "message", payload: parsed as unknown as ChatBackendResponse };
      } else if (frame.event === "error") {
        yield { kind: "error", error: String(parsed.error ?? "stream error") };
      } else {
        yield { kind: "progress", event: String(parsed.event ?? frame.event), ...parsed };
      }
    }
  }
}

export async function chatWithFallback(
  payload: ChatPayload,
  geminiFallback?: (system: string, user: string) => Promise<{ text: string; error?: string }>
): Promise<{ response: ChatBackendResponse; fallback_used: boolean }> {
  try {
    const response = await chatBackend(payload);
    return { response, fallback_used: false };
  } catch (primaryErr) {
    const allowBrowser =
      import.meta.env.DEV || import.meta.env.VITE_ENABLE_BROWSER_LLM_FALLBACK === "true";
    if (geminiFallback && allowBrowser) {
      const result = await geminiFallback("", payload.message);
      if (result.error && !result.text) throw primaryErr;
      return {
        response: {
          content: result.text,
          task_id: null,
          confidence: 0.5,
          tools_used: [],
          thinking: null,
          agent_outputs: [],
          llm_degraded: true,
          llm_degraded_reason: "browser_fallback",
        },
        fallback_used: true,
      };
    }
    throw primaryErr;
  }
}

export type FetchProductFromUrlResult = {
  product_name: string;
  product_description: string;
  category: string;
  brand?: string;
  price_text?: string;
  confidence: number;
  sources: Array<{ uri: string; title: string }>;
  model?: string;
  degraded: boolean;
  degraded_reason?: string | null;
};

export async function fetchProductFromUrl(url: string): Promise<FetchProductFromUrlResult> {
  const res = await fetch(resolveBackendUrl("/api/v1/products/fetch-from-url"), {
    method: "POST",
    headers: backendHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`fetch-from-url ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
  return (await res.json()) as FetchProductFromUrlResult;
}

export async function estimateApprovalImpact(approvalId: string): Promise<string | null> {
  try {
    const res = await fetch(resolveBackendUrl(`/api/v1/approvals/${approvalId}/estimate`), {
      method: "POST",
      headers: backendHeaders(),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { expected_impact?: string };
    return body.expected_impact ?? null;
  } catch {
    return null;
  }
}
