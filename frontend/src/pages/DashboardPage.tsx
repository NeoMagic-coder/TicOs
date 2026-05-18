// @ts-nocheck
// ============================================================
// AGENT.OS — Dashboard page
// ============================================================
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Icon, StatusDot, Sparkline, AgentAvatar, KpiTile, SectionHead } from '@/components/AOS/widgets';
import { AGENTS, AGENT_BY_ID } from '@/data/aos/mockData';
import { useAdaptedDashboard } from '@/lib/aos/adapter';
import { useStore } from '@/stores/useStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BASE_URL, backendHeaders } from '@/lib/api';

// ============================================================
// Sales trend chart
// ============================================================
const SalesTrend = () => {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const dash = useAdaptedDashboard();
  const trendData = dash.kpis.salesTrendNums.length
    ? dash.kpis.salesTrendNums.map((v: number, i: number) => ({ sales: v, day: dash.kpis.salesTrendLabels?.[i] || '' }))
    : new Array(7).fill(0).map((_, i) => ({ sales: 0, day: '' }));

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const W = c.parentElement.clientWidth - 28;
    const H = 260;
    c.width = W * dpr; c.height = H * dpr;
    c.style.width = W + 'px'; c.style.height = H + 'px';
    const ctx = c.getContext('2d'); ctx.scale(dpr, dpr);

    const padL = 50, padR = 16, padT = 16, padB = 30;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const data = trendData.map(d => d.sales);
    const min = 0, max = Math.max(...data) * 1.1;
    const stepX = innerW / (data.length - 1);
    const points = data.map((v, i) => [padL + i * stepX, padT + innerH - (v / max) * innerH]);

    ctx.clearRect(0, 0, W, H);
    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    ctx.font = '10px "Geist Mono", monospace';
    ctx.fillStyle = '#4A5060';
    for (let i = 0; i <= 4; i++) {
      const y = padT + (i / 4) * innerH;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + innerW, y); ctx.stroke();
      const val = Math.round(max * (1 - i/4));
      ctx.fillText('₺' + (val / 1000).toFixed(0) + 'k', 8, y + 3);
    }
    // X labels
    trendData.forEach((d, i) => {
      ctx.fillStyle = '#7C8497';
      ctx.fillText(d.day || '', padL + i * stepX - 12, padT + innerH + 18);
    });

    // Gradient fill
    const grad = ctx.createLinearGradient(0, padT, 0, padT + innerH);
    grad.addColorStop(0, 'rgba(199,255,61,0.25)');
    grad.addColorStop(1, 'rgba(199,255,61,0.00)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(points[0][0], padT + innerH);
    points.forEach(([x, y]) => ctx.lineTo(x, y));
    ctx.lineTo(points[points.length-1][0], padT + innerH);
    ctx.closePath(); ctx.fill();

    // Line
    ctx.strokeStyle = '#C7FF3D';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
    ctx.stroke();

    // Dots
    points.forEach(([x, y], i) => {
      ctx.fillStyle = '#0D0F13';
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#C7FF3D';
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI*2); ctx.stroke();
    });

    // Highlight today's spike with a label
    const lastIdx = points.length - 1;
    const [lx, ly] = points[lastIdx];
    ctx.fillStyle = '#C7FF3D';
    ctx.font = '600 11px "Geist Mono", monospace';
    const lastVal = data[data.length - 1] || 0;
    const lastLabel = lastVal >= 1000 ? '₺' + (lastVal / 1000).toFixed(1) + 'k' : '₺' + lastVal;
    ctx.fillText(lastLabel, lx - 38, ly - 10);

  }, [trendData]);

  return (
    <div style={{ position: 'relative', padding: 14 }}>
      <canvas ref={ref} />
    </div>
  );
};

// ============================================================
// Channel bars
// ============================================================
const ChannelBars = () => {
  const dash = useAdaptedDashboard();
  // Only render real channel data — the previous fallback drew the seed
  // `FALLBACK_CHANNELS` (Shopify 47 sipariş / ₺8.200) when the store was empty,
  // which made every fresh workspace look like it had Shopify traffic.
  const CHANNELS = dash.channels || [];
  const hasData = CHANNELS.some((c: any) => (c.sales || 0) > 0 || (c.orders || 0) > 0);
  if (!hasData) {
    return (
      <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--fg-3)' }} className="mono">
        — henüz satış verisi yok —
        <div style={{ marginTop: 6, fontSize: 11 }}>Kanallar bağlandığında ve sipariş geldiğinde performans dağılımı burada görünecek.</div>
      </div>
    );
  }
  const total = CHANNELS.reduce((s: number, c: any) => s + (c.sales || 0), 0) || 1;
  return (
    <div style={{ padding: '8px 0' }}>
      {CHANNELS.map((c: any) => (
        <div key={c.name} style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, background: c.color || '#9B7BFF', borderRadius: 2 }} />
              <span style={{ color: 'var(--fg-1)' }}>{c.name}</span>
              <span style={{ color: 'var(--fg-3)' }} className="mono">{c.orders || 0} sipariş</span>
            </span>
            <span style={{ color: 'var(--fg-1)' }} className="mono tnum">
              {c.sales >= 1000
                ? `₺${(c.sales / 1000).toFixed(c.sales >= 10000 ? 0 : 1)}K`
                : `₺${(c.sales || 0).toLocaleString('tr-TR')}`}
              {' '}<span style={{ color: 'var(--fg-3)', marginLeft: 8 }}>· {Math.round(((c.sales || 0) / total) * 100)}%</span>
            </span>
          </div>
          <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ width: ((c.sales || 0) / total * 100) + '%', height: '100%', background: c.color || '#9B7BFF', opacity: 0.85 }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================
// Live agent activity feed
// ============================================================
const LiveAgentFeed = () => {
  // Always render real audit-log entries — the previous version spun up a
  // 2.5-second `makeEvent()` synthesizer to fake activity when the store was
  // empty, which made the dashboard look alive even with no real backend.
  const storeLogs = useStore((s: any) => s.auditLogs);
  const items = (storeLogs || []).slice(0, 10).map((l: any) => ({
    _key: l.id,
    ts: new Date(l.timestamp).toLocaleTimeString('tr-TR', { hour12: false }),
    event: l.action,
    agent: l.actor_id,
    level: (l.metadata as any)?.level || 'info',
    msg: l.details,
  }));

  if (items.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }} className="mono">
        — henüz olay yok — bir görev çalıştığında satırlar burada görünecek
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: 4 }}>
      {items.map((it: any, i: number) => {
        const agent = AGENT_BY_ID[it.agent];
        const color = it.level === 'warn' ? 'var(--amber)' : it.level === 'ok' ? 'var(--acid)' : 'var(--fg-2)';
        return (
          <div
            key={it._key}
            style={{
              display: 'grid',
              gridTemplateColumns: '72px 22px 130px 1fr',
              gap: 8,
              padding: '5px 10px',
              alignItems: 'center',
              opacity: 1 - (i * 0.04),
              borderBottom: '1px solid var(--border-faint)',
              borderRadius: 2,
              background: i === 0 ? 'var(--acid-soft)' : 'transparent',
              transition: 'background 0.6s ease',
            }}
          >
            <span style={{ color: 'var(--fg-3)' }}>{it.ts.slice(0, 8)}</span>
            {agent ? <AgentAvatar agent={agent} size={18} /> : <span style={{ width: 18, height: 18, background: 'var(--bg-3)', borderRadius: 3 }} />}
            <span style={{ color }}>{it.event}</span>
            <span style={{ color: 'var(--fg-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.msg}</span>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================
// Active integrations
// ============================================================
// Integration grid — derived from the live tool registry (one row per provider
// the registry knows about). Previously this was a hardcoded list of eight
// providers with fake latencies and "1 sn önce" timestamps.
const PROVIDER_COLOR: Record<string, string> = {
  shopify: '#95BF47',
  trendyol: '#F27A1A',
  hepsiburada: '#FF6000',
  google: '#F9AB00',
  ga4: '#F9AB00',
  meta: '#0866FF',
  amazon: '#FF9900',
  gemini: '#4285F4',
  pgvector: '#9B7BFF',
  internal: '#7C8497',
};

const IntegrationGrid = () => {
  const tools = useStore((s: any) => s.tools) || [];
  const setCurrentPage = useStore((s: any) => s.setCurrentPage);
  const providers = useMemo(() => {
    const byProvider: Record<string, { live: number; mock: number; latencies: number[] }> = {};
    for (const t of tools) {
      const p = (t.provider || 'internal').toLowerCase();
      if (!byProvider[p]) byProvider[p] = { live: 0, mock: 0, latencies: [] };
      if (t.mode === 'live') byProvider[p].live += 1; else byProvider[p].mock += 1;
      const ms = t.stats?.avg_duration_ms;
      if (typeof ms === 'number' && ms > 0) byProvider[p].latencies.push(ms);
    }
    return Object.entries(byProvider).map(([name, v]) => {
      const avgMs = v.latencies.length ? Math.round(v.latencies.reduce((s, x) => s + x, 0) / v.latencies.length) : null;
      const status: 'live' | 'mock' | 'mixed' = v.live > 0 && v.mock > 0 ? 'mixed' : v.live > 0 ? 'live' : 'mock';
      return { name, live: v.live, mock: v.mock, avgMs, status };
    }).sort((a, b) => (b.live + b.mock) - (a.live + a.mock));
  }, [tools]);

  if (!providers.length) {
    return (
      <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--fg-3)' }} className="mono">
        — tool registry boş — manifest yüklenmedi
        <div style={{ marginTop: 8 }}>
          <button className="btn btn--sm" onClick={() => setCurrentPage('tools')}>Araçlar sayfasına git</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border-faint)' }}>
      {providers.slice(0, 12).map((it) => {
        const dotColor = it.status === 'live' ? 'var(--acid)' : it.status === 'mock' ? 'var(--fg-3)' : 'var(--amber)';
        const color = PROVIDER_COLOR[it.name] || PROVIDER_COLOR.internal;
        return (
          <div key={it.name} style={{ padding: '10px 12px', background: 'var(--bg-1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: dotColor }} />
              <span style={{ fontSize: 12, color: 'var(--fg-1)', textTransform: 'capitalize' }}>{it.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--fg-3)' }}>
              <span style={{ color }}>{it.live} live · {it.mock} mock</span>
              <span>{it.avgMs != null ? `${it.avgMs}ms` : '—'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================
// Top-of-page critical alerts (banner row)
// ============================================================
const AlertBanner = () => {
  const quickAsk = useStore((s: any) => s.quickAsk);
  const setCurrentPage = useStore((s: any) => s.setCurrentPage);
  const dashboard = useStore((s: any) => s.dashboard);
  const approvals = useStore((s: any) => s.approvals);
  const auditLogs = useStore((s: any) => s.auditLogs);

  // Stock alert: first stock-type critical_alert from the live dashboard.
  const stockAlert = (dashboard?.critical_alerts || []).find((a: any) => a.type === 'stock');

  // Pending approvals — real count + risk breakdown.
  const pending = (approvals || []).filter((a: any) => a.status === 'pending' || a.status === 'estimating');
  const riskCounts = pending.reduce(
    (acc: any, a: any) => ({ ...acc, [a.risk_level]: (acc[a.risk_level] || 0) + 1 }),
    { high: 0, medium: 0, low: 0 } as Record<string, number>,
  );

  // Latest autonomy decision from the audit log.
  const autonomyLog = (auditLogs || []).find((l: any) =>
    /autonomous_decision|autonomy|auto[_.]approve|delegated/i.test(l?.action || ''),
  );

  // No alerts at all → render nothing rather than three confidently fabricated rows.
  if (!stockAlert && pending.length === 0 && !autonomyLog) return null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 1,
      background: 'var(--border-faint)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      overflow: 'hidden',
      marginBottom: 20,
    }}>
      {stockAlert ? (
        <div style={{ padding: '12px 16px', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: 4, background: 'var(--rose-soft)', color: 'var(--rose)', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <Icon name="alert" size={14} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>{stockAlert.title || 'Stok uyarısı'}</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{stockAlert.description || stockAlert.agent_id || '—'}</div>
          </div>
          <button
            className="btn btn--sm"
            onClick={() => quickAsk(`${stockAlert.title || 'stok'} için reorder noktası hesapla ve önerilen miktarda sipariş için onay aç.`)}
          >
            Reorder
          </button>
        </div>
      ) : <div style={{ background: 'var(--bg-1)' }} />}

      {pending.length > 0 ? (
        <div style={{ padding: '12px 16px', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: 4, background: 'var(--amber-soft)', color: 'var(--amber)', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <Icon name="approvals" size={14} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--fg-1)' }}>{pending.length} onay bekliyor</div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
              {riskCounts.high} yüksek · {riskCounts.medium} orta · {riskCounts.low} düşük
            </div>
          </div>
          <button className="btn btn--sm" onClick={() => setCurrentPage('approvals')}>İncele</button>
        </div>
      ) : <div style={{ background: 'var(--bg-1)' }} />}

      {autonomyLog ? (
        <div style={{ padding: '12px 16px', background: 'var(--bg-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: 4, background: 'var(--violet-soft)', color: 'var(--violet)', display: 'grid', placeItems: 'center', flex: 'none' }}>
            <Icon name="sparkles" size={14} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {autonomyLog.details || autonomyLog.action}
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
              {autonomyLog.actor_id || autonomyLog.action} · {new Date(autonomyLog.timestamp).toLocaleTimeString('tr-TR', { hour12: false })}
            </div>
          </div>
          <button className="btn btn--sm" onClick={() => setCurrentPage('audit')}>Aç</button>
        </div>
      ) : <div style={{ background: 'var(--bg-1)' }} />}
    </div>
  );
};

// ============================================================
// Daily plan card (next-step intelligence)
// ============================================================
const DailyPlan = () => {
  const quickAsk = useStore((s: any) => s.quickAsk);
  const items = [
    { t: '14:30', label: 'pricing.daily_review',      agent: 'pricing_agent',   status: 'queued' },
    { t: '15:00', label: 'reviews.daily_sweep',       agent: 'review_reputation_agent', status: 'queued' },
    { t: '15:30', label: 'campaign.refresh',          agent: 'marketing_agent', status: 'queued' },
    { t: '16:00', label: 'ops.hourly_sweep',          agent: 'operations_agent',status: 'queued' },
    { t: '18:00', label: 'memory.consolidation',      agent: 'autonomous_decision_agent', status: 'queued' },
  ];
  return (
    <div style={{ padding: '4px 0' }}>
      {items.map(it => {
        const agent = AGENT_BY_ID[it.agent];
        return (
          <div key={it.label} className="row" style={{ gridTemplateColumns: '48px 22px 1fr auto' }}>
            <span className="mono" style={{ color: 'var(--fg-3)', fontSize: 11 }}>{it.t}</span>
            <AgentAvatar agent={agent} size={20} />
            <div>
              <div style={{ fontSize: 12 }}>{it.label}</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{agent?.name}</div>
            </div>
            <button
              className="btn btn--sm btn--ghost"
              onClick={() => quickAsk(`${it.label} görevini şimdi çalıştır (${it.agent}).`)}
            >
              <Icon name="play" size={10} /> şimdi
            </button>
          </div>
        );
      })}
    </div>
  );
};

// ============================================================
// ROI Story Banner
// ============================================================
const MODE_LABELS = ['Başlangıç (0.saat)', 'Otonom Süreç (3.saat)', 'Sonuç'];
const MODE_ICONS = ['box', 'activity', 'check'];

const fakeSseEvents = [
  { event: 'task_started',      agent: 'hermes',          msg: 'Hermes görevi başlattı' },
  { event: 'plan_ready',        agent: 'hermes',          msg: 'Plan hazır: primary=pricing_agent' },
  { event: 'agent_started',     agent: 'pricing_agent',   msg: 'Pricing Agent çalışıyor' },
  { event: 'tool_called',       agent: 'pricing_agent',   msg: '→ margin_calculator' },
  { event: 'tool_called',       agent: 'pricing_agent',   msg: '→ campaign_discount_simulator' },
  { event: 'critic_scored',     agent: 'pricing_agent',   msg: 'Skor: 0.92' },
  { event: 'agent_completed',   agent: 'pricing_agent',   msg: 'Tamamlandı' },
  { event: 'agent_started',     agent: 'marketing_agent', msg: 'Marketing Agent çalışıyor' },
  { event: 'tool_called',       agent: 'marketing_agent', msg: '→ ab_test_designer' },
  { event: 'tool_called',       agent: 'marketing_agent', msg: '→ sentiment_analyzer' },
  { event: 'critic_scored',     agent: 'marketing_agent', msg: 'Skor: 0.88' },
  { event: 'agent_completed',   agent: 'marketing_agent', msg: 'Tamamlandı' },
  { event: 'merging',           agent: 'hermes',          msg: 'Sonuçlar birleştiriliyor' },
];

// Animated 0 → target counter for the ROI hero stat. ~1.4s ease-out.
const RoiCounter = ({ target }: { target: number }) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 1400;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(target * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <>+%{val.toFixed(1)}</>;
};

const RoiStoryBanner = () => {
  const [mode, setMode] = useState(-1);
  const [logs, setLogs] = useState<{ ts: string; event: string; msg: string }[]>([]);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll the log's own container only — never the page. scrollIntoView
    // (even with block:'nearest') still pulls the surrounding flex/grid layout
    // when the parent is below the fold, which yanks the viewport down.
    const el = logEndRef.current;
    if (!el) return;
    const scroller = el.parentElement;
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [logs]);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/demo/results`, { headers: backendHeaders() });
      if (res.ok) setResults(await res.json());
    } catch { /* ignore */ }
  }, []);

  const play = useCallback(async () => {
    setLoading(true);
    setLogs([]);
    setResults(null);

    setMode(0);
    setLogs(prev => [...prev, { ts: new Date().toLocaleTimeString('tr-TR', { hour12: false }), event: 'mode_change', msg: 'MOD 0 — Başlangıç' }]);
    await new Promise(r => setTimeout(r, 1200));

    setMode(1);
    setLogs(prev => [...prev, { ts: new Date().toLocaleTimeString('tr-TR', { hour12: false }), event: 'mode_change', msg: 'MOD 1 — Otonom Süreç başlatılıyor…' }]);

    for (let i = 0; i < fakeSseEvents.length; i++) {
      const ev = fakeSseEvents[i];
      // Daha okunabilir tempo — eskiden 280-600ms idi; jüri akışı izleyebilsin.
      await new Promise(r => setTimeout(r, 750 + Math.random() * 550));
      setLogs(prev => [...prev, { ts: new Date().toLocaleTimeString('tr-TR', { hour12: false }), event: ev.event, msg: ev.msg }]);
    }

    setMode(2);
    setLogs(prev => [...prev, { ts: new Date().toLocaleTimeString('tr-TR', { hour12: false }), event: 'mode_change', msg: 'MOD 2 — Sonuç' }]);
    await fetchResults();
    setLoading(false);
  }, [fetchResults]);

  const reset = useCallback(() => { setMode(-1); setLogs([]); setResults(null); setLoading(false); }, []);

  if (mode === -1) {
    return (
      <div className="panel" style={{ marginBottom: 20, textAlign: 'center' }}>
        <div className="panel__body" style={{ padding: '28px 20px' }}>
          <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>📊</div>
          <div style={{ fontSize: 14, color: 'var(--fg-1)', marginBottom: 4, fontWeight: 600 }}>ROI Hikayesi</div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 16, maxWidth: 400, margin: '0 auto 16px' }}>
            AgentOS'un 5 saatlik otonom operasyon hikâyesini adım adım izleyin. Süreç planlaması, ajan koordinasyonu ve nihai sonuçları görün.
          </div>
          <button className="btn btn--primary" onClick={play} disabled={loading}>
            <Icon name="play" size={14} /> ROI Hikayesini Oynat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ marginBottom: 20, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid var(--border-faint)',
        background: 'var(--bg-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 4,
              fontSize: 11, fontFamily: 'var(--font-mono)',
              background: mode === i ? (i === 2 ? 'var(--acid-soft)' : 'var(--bg-3)') : 'transparent',
              color: mode === i ? (i === 2 ? 'var(--acid)' : 'var(--fg-1)') : 'var(--fg-3)',
              border: '1px solid', borderColor: mode === i ? (i === 2 ? 'rgba(199,255,61,0.4)' : 'var(--border)') : 'transparent',
              transition: 'all 0.4s ease',
            }}>
              <span style={{ width: 16, height: 16, borderRadius: '50%', background: mode === i ? (i === 2 ? 'var(--acid)' : 'var(--fg-2)') : 'var(--fg-4)', display: 'grid', placeItems: 'center', fontSize: 9, color: '#000', fontWeight: 700 }}>{i}</span>
              {MODE_LABELS[i]}
            </div>
          ))}
        </div>
        {mode === 2 && (
          <button className="btn btn--sm btn--ghost" onClick={reset} style={{ fontSize: 10 }}>
            <Icon name="refresh" size={10} /> Sıfırla
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 0 }}>
        {/* Left: content */}
        <div style={{ borderRight: '1px solid var(--border-faint)', minHeight: 240 }}>
          {mode === 0 && (
            <div style={{ padding: 28, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 6, fontFamily: 'var(--font-mono)' }}>HENÜZ HİÇBİR ŞEY YAPILMADI</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 4 }}>Boş Ürün · 0 Satış · Marka Yok</div>
              <div style={{ fontSize: 12, color: 'var(--fg-3)', maxWidth: 360, margin: '12px auto 0' }}>
                Ürün tanımlanmamış, kanal bağlantısı yok, fiyatlandırma belirlenmemiş. Sistem sıfır durumunda.
              </div>
            </div>
          )}

          {mode === 1 && (
            <div style={{ padding: '8px 0', maxHeight: 300, overflowY: 'auto' }}>
              {logs.filter(l => l.event !== 'mode_change').map((l, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '64px 1fr', gap: 8,
                  padding: '4px 14px', fontSize: 11, fontFamily: 'var(--font-mono)',
                  borderBottom: '1px solid var(--border-faint)',
                  opacity: 1 - (i * 0.015),
                }}>
                  <span style={{ color: 'var(--fg-3)' }}>{l.ts}</span>
                  <span>
                    <span style={{
                      display: 'inline-block', padding: '0 5px', borderRadius: 2, marginRight: 6,
                      background: l.event === 'agent_started' ? 'var(--violet-soft)' : l.event === 'tool_called' ? 'var(--cyan-soft)' : l.event === 'critic_scored' ? 'var(--amber-soft)' : l.event === 'agent_completed' ? 'var(--acid-soft)' : 'var(--bg-3)',
                      color: l.event === 'agent_started' ? 'var(--violet)' : l.event === 'tool_called' ? 'var(--cyan)' : l.event === 'critic_scored' ? 'var(--amber)' : l.event === 'agent_completed' ? 'var(--acid)' : 'var(--fg-2)',
                      fontSize: 9,
                    }}>{l.event}</span>
                    {l.msg}
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}

          {mode === 2 && results && (
            <div style={{ padding: '14px 16px' }}>
              {/* Hero stat — jürinin tek bakışta gördüğü rakam */}
              <div style={{
                padding: '18px 16px 14px', borderRadius: 8, marginBottom: 12,
                border: '1px solid rgba(199,255,61,0.35)',
                background: 'linear-gradient(135deg, rgba(199,255,61,0.10), rgba(199,255,61,0.02))',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', marginBottom: 4 }}>
                  TAHMİNİ BRÜT KÂR MARJI
                </div>
                <div style={{ fontSize: 48, lineHeight: 1, fontWeight: 700, color: 'var(--acid)', fontFamily: 'var(--font-mono)' }}>
                  <RoiCounter target={results.gross_margin_pct} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 8, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--fg-1)' }}>{results.autonomous_decisions}</span> otonom karar
                  {' · '}
                  <span style={{ color: 'var(--fg-1)' }}>22</span> ajan
                  {' · '}
                  Gemini maliyeti <span style={{ color: 'var(--fg-1)' }}>${results.gemini_cost_usd}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Toplam Otonom Karar', value: results.autonomous_decisions, color: 'var(--acid)', icon: 'sparkles' },
                  { label: 'İnsana Yükseltilen', value: results.escalated_to_human, color: 'var(--amber)', icon: 'alert' },
                  { label: 'İşlem Başına Maliyet', value: `$${Number(results.cost_per_op_usd ?? results.gemini_cost_usd ?? 0).toFixed(2)}`, color: 'var(--violet)', icon: 'money' },
                  { label: 'Zaman Tasarrufu', value: `%${results.time_savings_pct ?? 80}`, color: 'var(--acid)', icon: 'zap' },
                  { label: 'Gemini Maliyeti', value: `$${results.gemini_cost_usd}`, color: 'var(--violet)', icon: 'money' },
                  { label: 'İnsan Eşdeğeri', value: `${results.human_equivalent?.people}× ${results.human_equivalent?.duration}`, color: 'var(--cyan)', icon: 'growth' },
                ].map((card, i) => (
                  <div key={i} style={{
                    padding: '10px 12px', borderRadius: 6,
                    border: '1px solid var(--border-faint)',
                    background: 'var(--bg-2)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <Icon name={card.icon as any} size={12} color={card.color} />
                      <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{card.label}</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: card.color, fontFamily: 'var(--font-mono)' }}>
                      {card.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: log / chart */}
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column' }}>
          {mode < 2 ? (
            <>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 8, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SSE Event Log</div>
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: 260 }}>
                {logs.filter(l => l.event !== 'mode_change').length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--fg-4)', textAlign: 'center', paddingTop: 40, fontFamily: 'var(--font-mono)' }}>— olay bekleniyor —</div>
                )}
                {logs.filter(l => l.event !== 'mode_change').map((l, i) => (
                  <div key={i} style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)', padding: '3px 0',
                    borderBottom: '1px solid var(--border-faint)', color: 'var(--fg-2)',
                    opacity: 1 - (i * 0.025),
                  }}>
                    <span style={{ color: 'var(--fg-4)', marginRight: 6 }}>{l.ts}</span>
                    <span style={{
                      display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                      background: l.event === 'agent_completed' ? 'var(--acid)' : l.event === 'tool_called' ? 'var(--cyan)' : 'var(--fg-3)',
                      marginRight: 4,
                    }} />
                    {l.event}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </>
          ) : results ? (
            <>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 8, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Zaman vs Kâr Marjı</div>
              <div style={{ flex: 1 }}>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={results.profit_margin_timeline}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-faint)" />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--fg-3)' }} tickFormatter={(v: number) => `${v}.s`} stroke="var(--border-faint)" />
                    <YAxis domain={[0, 20]} tick={{ fontSize: 10, fill: 'var(--fg-3)' }} tickFormatter={(v: number) => `%${v}`} stroke="var(--border-faint)" />
                    <Tooltip
                      formatter={(value: number) => [`${value}%`, 'Kâr Marjı']}
                      labelFormatter={(label: number) => `${label}. saat`}
                      contentStyle={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11 }}
                    />
                    <Line type="monotone" dataKey="margin" stroke="#C7FF3D" strokeWidth={2} dot={{ r: 3, fill: '#C7FF3D' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                <span>Saat 0 → 5</span>
                <span style={{ color: 'var(--acid)' }}>+%{results.gross_margin_pct} kâr marjı</span>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// DASHBOARD page
// ============================================================
const DashboardPage = () => {
  const dash = useAdaptedDashboard();
  const k = dash.kpis;
  const kT = dash.kpisT; // Telemetry-wrapped KPIs (source + freshness)
  const quickAsk = useStore((s: any) => s.quickAsk);
  const loadDemoFixtures = useStore((s: any) => s.loadDemoFixtures);
  const pingBackend = useStore((s: any) => s.pingBackend);
  const loadTools = useStore((s: any) => s.loadTools);
  const toggleSupervisorDock = useStore((s: any) => s.toggleSupervisorDock);
  const onRefresh = async () => {
    await Promise.all([pingBackend(), loadTools()]);
    loadDemoFixtures();
  };
  // Trend arrays — real if the store has values, otherwise zero-filled so we
  // never render the fallback "demo" trend as if it were the user's data.
  const trend = k.salesTrendNums.length ? k.salesTrendNums : new Array(7).fill(0);
  const ordersTrend = k.ordersTrendNums.length ? k.ordersTrendNums : new Array(7).fill(0);
  const roasTrend = k.roasTrendNums.length ? k.roasTrendNums : new Array(7).fill(0);
  const hasSales = trend.some((v: number) => v > 0);

  // Compute deltas from the trend instead of pretending to know yesterday.
  const pctDelta = (arr: number[]) => {
    if (arr.length < 2) return null;
    const cur = arr[arr.length - 1];
    const prev = arr[arr.length - 2];
    if (!prev) return null;
    return ((cur - prev) / prev) * 100;
  };
  const salesDelta = pctDelta(trend);
  const ordersDelta = pctDelta(ordersTrend);
  const roasDelta = pctDelta(roasTrend);
  const fmtDelta = (n: number | null) => (n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`);
  const dirOf = (n: number | null) => (n == null ? 'flat' : n >= 0 ? 'up' : 'down');
  const total7d = trend.reduce((s: number, v: number) => s + v, 0);

  // Real tool registry counts for the integrations header tag.
  const tools = useStore((s: any) => s.tools) || [];
  const liveCount = tools.filter((t: any) => t.mode === 'live').length;
  const mockCount = tools.length - liveCount;
  const avgLatencies = tools.map((t: any) => t.stats?.avg_duration_ms).filter((x: any) => typeof x === 'number' && x > 0);
  const avgLatency = avgLatencies.length ? Math.round(avgLatencies.reduce((s: number, x: number) => s + x, 0) / avgLatencies.length) : null;
  const dashboardLogs = useStore((s: any) => s.auditLogs) || [];
  const hasRecentLogs = dashboardLogs.some((l: any) => l.timestamp && Date.now() - new Date(l.timestamp).getTime() < 60 * 1000);
  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> DASHBOARD</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">
            Dashboard
            <span className="page__title-tag">
              {dash.isDemo ? 'DEMO' : 'CANLI'} · {new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
            </span>
            {dash.isDemo && (
              <span
                className="chip"
                title="Bu dashboard demo verisiyle dolduruldu. Gerçek rakamlar için backend rollup tablosu beklenir."
                style={{ background: 'rgba(255,177,61,0.10)', color: 'var(--amber)', border: '1px solid rgba(255,177,61,0.4)' }}
              >
                demo verisi
              </span>
            )}
          </h1>
          <p className="page__sub">
            Sistem genel durumu — KPI'lar, kanal performansı ve canlı ajan aktivitesi. Veri 30 sn'de bir yenilenir.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {kT.sales.source !== 'backend' && (
            <button
              className="btn btn--ghost"
              onClick={() => {
                loadDemoFixtures();
                requestAnimationFrame(() => {
                  window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                  document.querySelector('main')?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
                });
              }}
              title="Sahte rakamlarla dashboard'u doldurur — backend'i etkilemez."
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Icon name="sparkles" size={12} /> Demo verisi yükle
              <span
                style={{
                  fontSize: 9, letterSpacing: '0.08em', fontFamily: 'var(--font-mono)',
                  padding: '1px 5px', borderRadius: 3,
                  background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                }}
              >DEMO</span>
            </button>
          )}
          <button className="btn btn--ghost" onClick={onRefresh}>
            <Icon name="refresh" size={12} /> Yenile
          </button>
          <button className="btn" onClick={() => quickAsk('Bugün için günün planını çıkar: öncelikli görevler, riskler ve atılması gereken aksiyonlar.')}>
            <Icon name="flow" size={12} /> Günü Planla
          </button>
          <button className="btn btn--primary" onClick={() => toggleSupervisorDock()}>
            <Icon name="zap" size={12} /> Komut Ver
            <span className="btn__kbd">⌘K</span>
          </button>
        </div>
      </div>

      <RoiStoryBanner />

      <AlertBanner />

      <div className="grid grid--4" style={{ marginBottom: 20 }}>
        <KpiTile
          label="Bugünkü Satış"
          icon="money"
          value={k.sales}
          delta={fmtDelta(salesDelta)}
          deltaDir={dirOf(salesDelta)}
          sub={hasSales ? `son 7 gün toplam: ₺${total7d.toLocaleString('tr-TR')}` : 'satış verisi yok'}
          trend={trend}
          color="var(--acid)"
          telemetry={kT.sales}
        />
        <KpiTile
          label="Siparişler"
          icon="bag"
          value={k.orders}
          delta={fmtDelta(ordersDelta)}
          deltaDir={dirOf(ordersDelta)}
          sub="bugün"
          trend={ordersTrend}
          color="var(--cyan)"
          telemetry={kT.orders}
        />
        <KpiTile
          label="ROAS"
          icon="activity"
          value={k.roas}
          delta={fmtDelta(roasDelta)}
          deltaDir={dirOf(roasDelta)}
          sub="hedef 3.5x"
          trend={roasTrend}
          color="var(--violet)"
          telemetry={kT.roas}
        />
        <KpiTile
          label="Dönüşüm"
          icon="growth"
          value={k.conversion}
          delta="—"
          deltaDir="flat"
          sub="kampanya bazlı"
          trend={ordersTrend.map((o: number, i: number) => (trend[i] > 0 ? (o / trend[i]) * 100 : 0))}
          color="var(--amber)"
          telemetry={kT.conversion}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="panel">
          <div className="panel__head">
            <h3>Satış Trendi</h3>
            <span className="panel__head-tag">SON 7 GÜN</span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16, fontSize: 11, color: 'var(--fg-3)' }} className="mono">
              <span><span style={{ color: 'var(--acid)' }}>●</span> Satış</span>
              <span>Toplam: <span style={{ color: 'var(--fg-1)' }}>{hasSales ? `₺${total7d.toLocaleString('tr-TR')}` : '—'}</span></span>
            </span>
          </div>
          <SalesTrend />
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>Kanal Performansı</h3>
            <span className="panel__head-tag">BUGÜN</span>
          </div>
          <ChannelBars />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="panel">
          <div className="panel__head">
            <h3>Canlı Ajan Aktivitesi</h3>
            <span className="panel__head-tag">hermes.log</span>
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: hasRecentLogs ? 'var(--acid)' : 'var(--fg-3)' }} className="mono">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: hasRecentLogs ? 'var(--acid)' : 'var(--fg-4)', boxShadow: hasRecentLogs ? '0 0 6px var(--acid)' : 'none' }} />
              {hasRecentLogs ? 'CANLI' : 'BEKLEMEDE'}
            </span>
          </div>
          <LiveAgentFeed />
        </div>

        <div className="panel">
          <div className="panel__head">
            <h3>Bugünün Planı</h3>
            <span className="panel__head-tag">SCHEDULER</span>
          </div>
          <DailyPlan />
        </div>
      </div>

      <div className="panel">
        <div className="panel__head">
          <h3>Entegrasyonlar</h3>
          <span className="panel__head-tag">{liveCount} LIVE · {mockCount} MOCK</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-3)' }} className="mono">
            ortalama gecikme <span style={{ color: 'var(--fg-1)' }}>{avgLatency != null ? `${avgLatency}ms` : '—'}</span>
          </span>
        </div>
        <div className="panel__body panel__body--flush">
          <IntegrationGrid />
        </div>
      </div>
    </div>
  );
};




export default DashboardPage;
