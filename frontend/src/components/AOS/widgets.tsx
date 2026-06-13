// @ts-nocheck
// ============================================================
// AGENT.OS — shared widgets
// ============================================================
import React, { useEffect, useRef } from 'react';

// ----- Icons (lucide-style stroked SVG, 16x16 by default) -----
const Icon = ({ name, size = 16, color = 'currentColor', stroke = 1.6, style }) => {
  const props = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: color, strokeWidth: stroke,
    strokeLinecap: 'round', strokeLinejoin: 'round',
    style,
  };
  const paths = {
    dashboard:  <><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></>,
    chat:       <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    agents:     <><circle cx="9" cy="7" r="3"/><circle cx="17" cy="11" r="3"/><path d="M3 21v-1a5 5 0 0 1 5-5h2"/><path d="M13 21v-1a4 4 0 0 1 4-4h0"/></>,
    graph:      <><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7.4 7.4l3.2 9.2M16.6 7.4l-3.2 9.2M8 6h8"/></>,
    approvals:  <><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></>,
    tools:      <><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6.6 6.6 2.7 2.7 6.6-6.6a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.7-2.7z"/></>,
    audit:      <><path d="M4 6h16M4 12h16M4 18h10"/></>,
    brand:      <><circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/><circle cx="8.5" cy="6.5" r="1"/><circle cx="6.5" cy="11.5" r="1"/><path d="M12 2a10 10 0 0 0 0 20c1.7 0 1.5-2 2.5-3s3.5-1 3.5-3.5S15.5 12 12 13"/></>,
    money:      <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 1 0 0 7h5a3.5 3.5 0 1 1 0 7H6"/></>,
    onboarding: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>,
    settings:   <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    growth:     <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
    plus:       <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    chevright:  <><polyline points="9 18 15 12 9 6"/></>,
    chevdown:   <><polyline points="6 9 12 15 18 9"/></>,
    cmd:        <><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"/></>,
    search:     <><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.6" y2="16.6"/></>,
    activity:   <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    bolt:       <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    check:      <><polyline points="20 6 9 17 4 12"/></>,
    x:          <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    pause:      <><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></>,
    play:       <><polygon points="5 3 19 12 5 21 5 3"/></>,
    refresh:    <><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></>,
    chevrightSmall: <><polyline points="9 18 15 12 9 6"/></>,
    alert:      <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
    cpu:        <><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="15" x2="23" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/></>,
    zap:        <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    clock:      <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    bag:        <><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></>,
    layers:     <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
    mail:       <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></>,
    integration:<><circle cx="6" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M6 9v6a3 3 0 0 0 3 3h6"/></>,
    user:       <><circle cx="12" cy="7" r="4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/></>,
    sparkles:   <><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z"/><path d="M19 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7L19 14z"/></>,
    flow:       <><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="9" y="15" width="6" height="6" rx="1"/><path d="M6 9v3h12V9M12 12v3"/></>,
  };
  return <svg {...props}>{paths[name] || null}</svg>;
};

// ----- Status dot -----
const StatusDot = ({ status, size = 8 }) => (
  <span className={`status-dot status-dot--${status}`} style={{ width: size, height: size }} />
);

// ----- Sparkline canvas -----
const Sparkline = ({ data, color = 'var(--acid)', width = 200, height = 36, fill = true }) => {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr; c.height = height * dpr;
    c.style.width = width + 'px'; c.style.height = height + 'px';
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);
    if (!data.length) return;
    const min = Math.min(...data), max = Math.max(...data);
    const range = (max - min) || 1;
    const stepX = width / (data.length - 1 || 1);
    const points = data.map((v, i) => [i * stepX, height - 4 - ((v - min) / range) * (height - 8)]);
    // Get computed color (CSS variables don't work in canvas).
    const computed = color.startsWith('var(')
      ? getComputedStyle(document.documentElement).getPropertyValue(color.match(/--[\w-]+/)[0]).trim()
      : color;
    if (fill) {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, computed + '40');
      grad.addColorStop(1, computed + '00');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(points[0][0], height);
      points.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.lineTo(points[points.length - 1][0], height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = computed;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.stroke();
    // last point dot
    const [lx, ly] = points[points.length - 1];
    ctx.fillStyle = computed;
    ctx.beginPath(); ctx.arc(lx, ly, 2.2, 0, Math.PI * 2); ctx.fill();
  }, [data, color, width, height, fill]);
  return <canvas ref={ref} />;
};

// ----- Agent avatar (glyph tile) -----
const AgentAvatar = ({ agent, size = 28 }) => {
  if (!agent) return null;
  const fs = Math.max(10, size * 0.36);
  return (
    <span
      style={{
        width: size, height: size, flex: 'none',
        background: agent.accent + '22',
        color: agent.accent,
        border: `1px solid ${agent.accent}44`,
        borderRadius: 4,
        display: 'grid', placeItems: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: fs,
        fontWeight: 600,
        letterSpacing: '0.04em',
      }}
    >
      {agent.glyph}
    </span>
  );
};

// ----- KPI tile -----
/**
 * KpiTile. Optional `telemetry` prop carries a Telemetry contract — when
 * present the tile shows a small source/staleness badge next to the label.
 */
const KpiTile = ({ label, value, sub, delta, deltaDir = 'up', trend, color = 'var(--acid)', icon, telemetry }) => {
  // Compute badge from telemetry without coupling widgets.tsx to telemetry.ts.
  let sourceBadge = null;
  let staleDot = null;
  if (telemetry) {
    const t = telemetry;
    if (t.value != null && t.measuredAt) {
      const ageMs = Date.now() - new Date(t.measuredAt).getTime();
      if (ageMs > (t.freshSeconds ?? 300) * 1000) {
        staleDot = <span title="stale" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)' }} />;
      }
    }
    if (t.source === 'heuristic') {
      sourceBadge = <span className="mono" style={{ fontSize: 9, padding: '0 4px', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--amber)' }}>heuristic</span>;
    } else if (t.source === 'derived') {
      sourceBadge = <span className="mono" style={{ fontSize: 9, padding: '0 4px', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--fg-3)' }}>derived</span>;
    } else if (t.source === 'unknown') {
      sourceBadge = <span className="mono" style={{ fontSize: 9, padding: '0 4px', border: '1px solid var(--border)', borderRadius: 2, color: 'var(--fg-4)' }}>veri yok</span>;
    }
  }
  return (
    <div className="kpi">
      <div className="kpi__label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon && <Icon name={icon} size={11} color="var(--fg-3)" />}
        {label}
        {staleDot}
        {sourceBadge}
      </div>
      <div className="kpi__value tnum">{value}</div>
      <div className={`kpi__delta ${delta ? (deltaDir === 'up' ? 'kpi__delta--up' : 'kpi__delta--down') : ''}`}>
        {delta && <span>{deltaDir === 'up' ? '↑' : '↓'} {delta}</span>}
        {sub && <span style={{ color: 'var(--fg-3)' }}>{sub}</span>}
      </div>
      {trend && Array.isArray(trend) && trend.some((v: number) => v && v > 0) ? (
        <div className="kpi__spark">
          <Sparkline data={trend} color={color} width={180} height={36} />
        </div>
      ) : (
        <div
          className="kpi__spark"
          style={{
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--fg-4)',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            border: '1px dashed var(--border-faint)',
            borderRadius: 3,
            opacity: 0.6,
          }}
          title="Trend için yeterli veri yok"
        >
          — veri yok —
        </div>
      )}
    </div>
  );
};

// ----- Section header -----
const SectionHead = ({ title, eyebrow, count, action, tag }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12, gap: 12 }}>
    <div>
      {eyebrow && <div className="label-eyebrow" style={{ marginBottom: 4 }}>{eyebrow}</div>}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 500, letterSpacing: '-0.01em' }}>{title}</h2>
        {count != null && <span className="mono" style={{ color: 'var(--fg-3)', fontSize: 11 }}>· {count}</span>}
        {tag}
      </div>
    </div>
    {action}
  </div>
);

export { Icon, StatusDot, Sparkline, AgentAvatar, KpiTile, SectionHead };
