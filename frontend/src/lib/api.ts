/**
 * Backend HTTP client — Hermes chat, SSE stream, and shared fetch helpers.
 * See backend/apps/api/routes/chat.py for wire format.
 */

export const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? '';

export function backendHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const key = import.meta.env.VITE_API_KEY as string | undefined;
  if (key) headers['X-API-Key'] = key;
  return headers;
}

export function resolveBackendUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${normalized}`;
}

export async function backendReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      headers: backendHeaders(),
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface ChatTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatBackendResponse {
  content: string;
  task_id?: string | null;
  confidence: number;
  tools_used: string[];
  thinking?: string | null;
  agent_outputs: Record<string, unknown>[];
  llm_degraded?: boolean;
  llm_degraded_reason?: string | null;
}

export interface ChatRequestBody {
  message: string;
  history?: ChatTurn[];
  product_context?: Record<string, unknown> | null;
  language?: string;
}

export type ChatStreamEvent =
  | ({ kind: 'progress' } & Record<string, unknown> & { event: string })
  | { kind: 'message'; payload: ChatBackendResponse }
  | { kind: 'error'; error: string };

export async function chatBackend(body: ChatRequestBody): Promise<ChatBackendResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/chat`, {
    method: 'POST',
    headers: { ...backendHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json();
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  let event = 'message';
  const dataLines: string[] = [];
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  return { event, data: dataLines.join('\n') };
}

export async function streamChatBackend(
  body: ChatRequestBody,
): Promise<AsyncIterable<ChatStreamEvent>> {
  const res = await fetch(`${BASE_URL}/api/v1/chat/stream`, {
    method: 'POST',
    headers: { ...backendHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  async function* iterate(): AsyncGenerator<ChatStreamEvent> {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const part of parts) {
          const frame = parseSseBlock(part.trim());
          if (!frame) continue;
          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(frame.data);
          } catch {
            continue;
          }
          if (frame.event === 'message') {
            yield { kind: 'message', payload: parsed as ChatBackendResponse };
          } else if (frame.event === 'error') {
            yield { kind: 'error', error: String(parsed.error || 'stream error') };
          } else {
            yield { kind: 'progress', event: String(parsed.event || frame.event), ...parsed };
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  return iterate();
}

export async function chatWithFallback(
  body: ChatRequestBody,
  geminiFallback?: (system: string, user: string) => Promise<{ text?: string; error?: string }>,
): Promise<{ response: ChatBackendResponse; fallback_used: boolean }> {
  try {
    const response = await chatBackend(body);
    return { response, fallback_used: false };
  } catch (primaryErr) {
    if (!geminiFallback) throw primaryErr;
    const system =
      'Sen TicOSClaw supervisor asistanısın. Türkçe, somut ve aksiyona dönük yanıt ver.';
    const out = await geminiFallback(system, body.message);
    if (out.error || !out.text) throw primaryErr;
    return {
      fallback_used: true,
      response: {
        content: out.text,
        confidence: 0.6,
        tools_used: [],
        agent_outputs: [{ agent_id: 'supervisor', content: out.text }],
        llm_degraded: true,
        llm_degraded_reason: 'browser_fallback',
      },
    };
  }
}

export async function estimateApprovalImpact(id: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/approvals/${encodeURIComponent(id)}/estimate`, {
      method: 'POST',
      headers: backendHeaders(),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data === 'string') return data;
    if (typeof data?.expected_impact === 'string') return data.expected_impact;
    if (typeof data?.impact === 'string') return data.impact;
    return null;
  } catch {
    return null;
  }
}

export async function fetchProductFromUrl(url: string): Promise<Partial<Record<string, string>>> {
  const res = await fetch(`${BASE_URL}/api/v1/products/fetch-from-url`, {
    method: 'POST',
    headers: { ...backendHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json();
}
