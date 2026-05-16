// FastAPI backend client. Talks to apps/api running on :8000 by default.
export const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://127.0.0.1:8000';

/** Resolve relative paths (e.g. /images/abc.png) to fully-qualified backend URLs. */
export function resolveBackendUrl(path: string): string {
  if (!path) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
}

export interface BackendAgentOutput {
  agent_id: string;
  task_id: string;
  status: 'completed' | 'failed' | 'escalated';
  confidence: number;
  iterations_used: number;
  tools_called: { tool_id: string; agent_id: string; task_id: string; duration_ms: number; status: string; cost_usd: number }[];
  summary: string;
  content: string;
  findings: string[];
  recommended_actions: { action: string; params: Record<string, unknown>; requires_approval: boolean; risk_level: string; expected_impact: string }[];
  next_step: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface ChatBackendResponse {
  content: string;
  task_id: string;
  confidence: number;
  tools_used: string[];
  thinking: string | null;
  agent_outputs: BackendAgentOutput[];
}

export interface ChatBackendRequest {
  message: string;
  history?: { role: 'user' | 'assistant' | 'system'; content: string }[];
  product_context?: Record<string, unknown> | null;
}

export async function chatBackend(req: ChatBackendRequest): Promise<ChatBackendResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backend ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function estimateApprovalImpact(approvalId: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/approvals/${approvalId}/estimate`, { method: 'POST' });
    if (!res.ok) return null;
    const body = await res.json();
    return typeof body?.expected_impact === 'string' ? body.expected_impact : null;
  } catch {
    return null;
  }
}

export async function backendReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Wrap chatBackend with an automatic Gemini fallback. When the FastAPI backend
 * returns 5xx, times out, or refuses connection, this synthesizes a
 * ChatBackendResponse from a direct browser → Gemini call so brand/pricing
 * regeneration still works while the backend is down.
 *
 * The returned envelope carries `fallback_used` so callers can:
 *   - tag audit logs with `fallback_used: true`
 *   - show a "_(backend offline — Gemini)_" badge in the UI
 */
export interface ChatWithFallbackResult {
  response: ChatBackendResponse;
  fallback_used: boolean;
  fallback_reason?: string;
}

export async function chatWithFallback(
  req: ChatBackendRequest,
  geminiFallback?: (system: string, user: string) => Promise<{ text: string; error?: string }>,
): Promise<ChatWithFallbackResult> {
  try {
    const response = await chatBackend(req);
    return { response, fallback_used: false };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    if (!geminiFallback) throw err;
    const system =
      'Sen OneProduct Agent OS\'un Supervisor rolündesin. Türkçe, somut, JSON istenirse JSON, aksi halde aksiyona dönük cevap ver.';
    const result = await geminiFallback(system, req.message);
    if (result.error || !result.text) {
      throw new Error(`Backend offline (${reason}); Gemini fallback hata: ${result.error || 'boş yanıt'}`);
    }
    const now = new Date().toISOString();
    return {
      fallback_used: true,
      fallback_reason: reason,
      response: {
        content: result.text,
        task_id: `fallback_${Date.now()}`,
        confidence: 0.6,
        tools_used: [],
        thinking: `Backend kapalı (${reason}) — doğrudan Gemini çağrıldı.`,
        agent_outputs: [
          {
            agent_id: 'supervisor',
            task_id: `fallback_${Date.now()}`,
            status: 'completed',
            confidence: 0.6,
            iterations_used: 1,
            tools_called: [],
            summary: result.text.slice(0, 240),
            content: result.text,
            findings: [],
            recommended_actions: [],
            next_step: null,
            started_at: now,
            completed_at: now,
          },
        ],
      },
    };
  }
}

// ---- SSE streaming ----------------------------------------------------------

export type ChatStreamEvent =
  | { kind: 'progress'; event: string; [k: string]: unknown }
  | { kind: 'message'; payload: ChatBackendResponse }
  | { kind: 'error'; error: string };

/**
 * POSTs to /api/v1/chat/stream and yields SSE frames as they arrive.
 *
 * EventSource only supports GET, so we use fetch + ReadableStream and parse
 * the SSE wire format ourselves. The server emits:
 *   - event: progress  → per-step progress (agent_started, tool_called, ...)
 *   - event: message   → final ChatBackendResponse payload
 *   - event: error     → fatal error
 */
export async function streamChatBackend(
  req: ChatBackendRequest,
  signal?: AbortSignal,
): Promise<AsyncGenerator<ChatStreamEvent>> {
  const res = await fetch(`${BASE_URL}/api/v1/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    const body = res.body ? await res.text() : '';
    throw new Error(`Backend ${res.status}: ${body.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');

  async function* iterate(): AsyncGenerator<ChatStreamEvent> {
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line.
      let frameEnd = buffer.indexOf('\n\n');
      while (frameEnd !== -1) {
        const frame = buffer.slice(0, frameEnd);
        buffer = buffer.slice(frameEnd + 2);
        frameEnd = buffer.indexOf('\n\n');

        let event = 'progress';
        let data = '';
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (!data) continue;
        try {
          const parsed = JSON.parse(data);
          if (event === 'message') yield { kind: 'message', payload: parsed };
          else if (event === 'error') yield { kind: 'error', error: parsed.error ?? 'unknown' };
          else yield { kind: 'progress', event: parsed.event ?? event, ...parsed };
        } catch {
          // ignore malformed frames
        }
      }
    }
  }
  return iterate();
}
