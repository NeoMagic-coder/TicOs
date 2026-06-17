// @ts-nocheck
/**
 * Renders a Telemetry<T> with honesty markers:
 *   - "—" when null
 *   - amber dot when stale (older than freshSeconds)
 *   - small "heuristic" / "derived" badge when source isn't pure backend
 *   - tooltip carrying source + age
 *
 * Use directly in stat tiles, KPI tiles, or inline metrics.
 */
import React from 'react';
import { type Telemetry, sourceLabel, ageLabel, isStale } from '@/lib/telemetry';

interface TelemetryValueProps<T> {
  t: Telemetry<T>;
  format?: (v: T) => string;
  empty?: string;
  className?: string;
  style?: React.CSSProperties;
  showBadge?: boolean;
}

export function TelemetryValue<T = number>({
  t,
  format = (v: any) => String(v),
  empty = '—',
  className,
  style,
  showBadge = true,
}: TelemetryValueProps<T>) {
  if (t.value == null) {
    return (
      <span
        className={className}
        title={[sourceLabel(t.source), t.note].filter(Boolean).join(' · ')}
        style={{ color: 'var(--fg-4)', ...style }}
      >
        {empty}
      </span>
    );
  }
  const stale = isStale(t);
  const tip = [sourceLabel(t.source), ageLabel(t), t.note].filter(Boolean).join(' · ');
  const showHeuristic = showBadge && t.source === 'heuristic';
  const showDerived = showBadge && t.source === 'derived';
  return (
    <span title={tip} className={className} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, ...style }}>
      <span>{format(t.value)}</span>
      {stale && (
        <span
          aria-label="stale"
          style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--amber)', display: 'inline-block', alignSelf: 'center',
          }}
        />
      )}
      {showHeuristic && (
        <span className="mono" style={{
          fontSize: 9, padding: '1px 4px', border: '1px solid var(--border)',
          borderRadius: 2, color: 'var(--amber)', alignSelf: 'center',
        }}>heuristic</span>
      )}
      {showDerived && (
        <span className="mono" style={{
          fontSize: 9, padding: '1px 4px', border: '1px solid var(--border)',
          borderRadius: 2, color: 'var(--fg-3)', alignSelf: 'center',
        }}>derived</span>
      )}
    </span>
  );
}
