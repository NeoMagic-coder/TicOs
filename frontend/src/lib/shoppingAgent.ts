import { BASE_URL, backendHeaders, resolveBackendUrl } from '@/lib/api';

export const SHOPPING_AGENT_URL = resolveBackendUrl('/api/v1/shopping');

export async function shoppingAgentReachable(timeoutMs = 4000): Promise<boolean> {
  try {
    const res = await fetch(resolveBackendUrl('/api/v1/shopping/metrics'), {
      headers: backendHeaders(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchShoppingMetrics() {
  const res = await fetch(resolveBackendUrl('/api/v1/shopping/metrics'), {
    headers: backendHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`metrics ${res.status}`);
  return res.json();
}

export async function runShoppingAgent(goal: Record<string, unknown>) {
  const res = await fetch(resolveBackendUrl('/api/v1/shopping/runs/sync'), {
    method: 'POST',
    headers: backendHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(goal),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`shopping run ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  return res.json();
}

export async function sendShoppingFeedback(
  runId: string,
  payload: { recommendation_accurate: boolean; satisfaction: number },
) {
  const res = await fetch(resolveBackendUrl(`/api/v1/shopping/runs/${runId}/feedback`), {
    method: 'POST',
    headers: backendHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`feedback ${res.status}`);
  return res.json();
}
