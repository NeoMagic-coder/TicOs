import { BASE_URL, backendHeaders } from '@/lib/api';

export const SHOPPING_AGENT_URL = `${BASE_URL}/api/v1/shopping`;

export async function shoppingAgentReachable(): Promise<boolean> {
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

export async function runShoppingAgent(goal: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${SHOPPING_AGENT_URL}/runs/sync`, {
    method: 'POST',
    headers: { ...backendHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(goal),
    signal: AbortSignal.timeout(180000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchShoppingMetrics(): Promise<Record<string, unknown>> {
  const res = await fetch(`${SHOPPING_AGENT_URL}/metrics`, {
    headers: backendHeaders(),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function sendShoppingFeedback(
  runId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${SHOPPING_AGENT_URL}/runs/${encodeURIComponent(runId)}/feedback`, {
    method: 'POST',
    headers: { ...backendHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}
