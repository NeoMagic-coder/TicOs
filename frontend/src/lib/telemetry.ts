export type TelemetrySource = 'backend' | 'derived' | 'heuristic' | 'demo' | 'unknown';

export interface Telemetry<T = number> {
  value: T | null;
  source: TelemetrySource;
  measured_at?: string | null;
  freshSeconds?: number;
  note?: string;
}

const DEFAULT_FRESH_SECONDS = 120;

export function makeTelemetry<T>(
  value: T | null | undefined,
  source: TelemetrySource,
  opts?: { measured_at?: string | null; freshSeconds?: number; note?: string },
): Telemetry<T> {
  return {
    value: value ?? null,
    source,
    measured_at: opts?.measured_at ?? null,
    freshSeconds: opts?.freshSeconds ?? DEFAULT_FRESH_SECONDS,
    note: opts?.note,
  };
}

export function sourceLabel(source: TelemetrySource): string {
  switch (source) {
    case 'backend':
      return 'backend';
    case 'derived':
      return 'derived';
    case 'heuristic':
      return 'heuristic';
    case 'demo':
      return 'demo';
    default:
      return 'unknown';
  }
}

export function ageLabel(t: Telemetry<unknown>): string {
  if (!t.measured_at) return '';
  const ms = Date.now() - new Date(t.measured_at).getTime();
  if (ms < 60_000) return 'az önce';
  if (ms < 3600_000) return `${Math.round(ms / 60_000)} dk önce`;
  return `${Math.round(ms / 3600_000)} sa önce`;
}

export function isStale(t: Telemetry<unknown>): boolean {
  if (t.value == null || !t.measured_at) return false;
  const freshMs = (t.freshSeconds ?? DEFAULT_FRESH_SECONDS) * 1000;
  return Date.now() - new Date(t.measured_at).getTime() > freshMs;
}
