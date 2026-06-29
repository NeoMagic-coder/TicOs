/** Honest telemetry wrapper — value + provenance + freshness. */

export type TelemetrySource = 'backend' | 'derived' | 'heuristic' | 'unknown';

export type Telemetry<T = number> = {
  value: T | null;
  source: TelemetrySource;
  measuredAt?: string | null;
  freshSeconds?: number;
  note?: string;
};

export function sourceLabel(source: TelemetrySource): string {
  switch (source) {
    case 'backend':
      return 'backend';
    case 'derived':
      return 'türetilmiş';
    case 'heuristic':
      return 'tahmini';
    default:
      return 'bilinmiyor';
  }
}

export function ageLabel(t: Telemetry<unknown>): string {
  if (!t.measuredAt) return '';
  const ms = Date.now() - new Date(t.measuredAt).getTime();
  if (ms < 60_000) return 'az önce';
  if (ms < 3600_000) return `${Math.round(ms / 60_000)} dk önce`;
  return `${Math.round(ms / 3600_000)} sa önce`;
}

export function isStale(t: Telemetry<unknown>): boolean {
  if (t.value == null || !t.measuredAt) return false;
  const fresh = (t.freshSeconds ?? 300) * 1000;
  return Date.now() - new Date(t.measuredAt).getTime() > fresh;
}

export function telemetry<T>(
  value: T | null | undefined,
  source: TelemetrySource,
  measuredAt?: string | null,
  note?: string,
): Telemetry<T> {
  return {
    value: value == null ? null : value,
    source,
    measuredAt: measuredAt ?? null,
    freshSeconds: 300,
    note,
  };
}
