// @ts-nocheck
// ============================================================
// AGENT.OS — Dashboard page
// ============================================================
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Icon, Sparkline, AgentAvatar, KpiTile } from '@/components/AOS/widgets';
import { AGENTS, AGENT_BY_ID } from '@/data/aos/mockData';
import { useAdaptedDashboard } from '@/lib/aos/adapter';
import { useStore } from '@/stores/useStore';
import { BASE_URL, backendHeaders } from '@/lib/api';

// ============================================================
// Sales trend chart
// ============================================================
const SalesTrend = () => {
  const ref = useRef(null);
  const [hover, setHover] = useState(null);
  const dash = useAdaptedDashboard();
  const kpiSales = dash?.kpis?.salesTrendNums ?? [];
  const kpiLabels = dash?.kpis?.salesTrendLabels ?? [];
  const trendData = kpiSales.length
    ? kpiSales.map((v: number, i: number) => ({ sales: v, day: kpiLabels[i] || '' }))
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
// Otonom hedef ilerlemesi (Paperclip goals)
// ============================================================
const GoalsProgressPanel = () => {
  const autonomyStatus = useStore((s: any) => s.autonomyStatus);
  const runGoalLoopTick = useStore((s: any) => s.runGoalLoopTick);
  const setCurrentPage = useStore((s: any) => s.setCurrentPage);
  const loadAutonomyStatus = useStore((s: any) => s.loadAutonomyStatus);
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/goals/overview`, {
        headers: backendHeaders(),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = await res.json();
        setGoals(Array.isArray(data?.goals) ? data.goals : []);
      }
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void loadAutonomyStatus();
  }, [refresh, loadAutonomyStatus]);

  const loop = autonomyStatus?.goal_loop;
  const autonomyOn = autonomyStatus?.mode?.enabled !== false;

  if (loading && !goals.length) {
    return (
      <div style={{ padding: 20, fontSize: 12, color: 'var(--fg-3)' }} className="mono">
        Hedefler yükleniyor…
      </div>
    );
  }

  if (!goals.length) {
    return (
      <div style={{ padding: 20, textAlign: 'center', fontSize: 12, color: 'var(--fg-3)' }}>
        Henüz hedef yok. Ürün onboard edildiğinde varsayılan hedefler otomatik oluşur.
        <div style={{ marginTop: 10 }}>
          <button type="button" className="btn btn--sm" onClick={() => setCurrentPage('goals')}>
            Hedefler sayfasına git
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-goals">
      <div className="dash-goals__meta mono">
        <span className={autonomyOn ? 'dash-goals__meta--on' : ''}>
          {autonomyOn ? 'OTONOM' : 'MANUEL'}
        </span>
        <span>{loop?.active_goals ?? goals.length} aktif</span>
        {(loop?.stale_count ?? 0) > 0 && (
          <span className="dash-goals__meta--stale">{loop.stale_count} bekleyen</span>
        )}
        {loop?.last_tick_at && (
          <span>Son tick {new Date(loop.last_tick_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>
      <div className="dash-goals__list">
        {goals.map((g) => {
          const pct = g.progress_pct;
          const barWidth = pct != null ? `${pct}%` : g.task_count > 0 ? '35%' : '8%';
          const barLabel = pct != null ? `${pct}%` : g.task_count > 0 ? `${g.task_count} görev` : 'başlamadı';
          return (
            <div key={g.id} className={`dash-goals__row ${g.stale ? 'dash-goals__row--stale' : ''}`}>
              <div className="dash-goals__row-head">
                <span className="dash-goals__title">{g.title}</span>
                {g.stale && <span className="dash-goals__stale-tag mono">bekliyor</span>}
              </div>
              <div className="dash-goals__bar">
                <div className="dash-goals__bar-fill" style={{ width: barWidth }} />
              </div>
              <div className="dash-goals__row-foot mono">
                <span>{g.target_metric || '—'}{g.target_value != null ? ` → ${g.target_value}` : ''}</span>
                <span>{barLabel}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="dash-goals__actions">
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => setCurrentPage('goals')}>
          Tüm hedefler
        </button>
        <button type="button" className="btn btn--sm" onClick={() => void runGoalLoopTick().then(refresh)}>
          Hedef döngüsü
        </button>
      </div>
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
const JOB_AGENT_HINT: Record<string, string> = {
  'ops.hourly_sweep': 'operations_agent',
  'pricing.daily_review': 'dynamic_pricing_agent',
  'reviews.daily_sweep': 'review_reputation_agent',
  'autonomy.morning_brief': 'supervisor',
  'autonomy.integration_pulse': 'autonomous_decision_agent',
  'autonomy.approval_sweep': 'autonomous_decision_agent',
  'autonomy.goal_loop': 'supervisor',
  'autonomy.boot_pulse': 'autonomous_decision_agent',
};

const DailyPlan = () => {
  const autonomyStatus = useStore((s: any) => s.autonomyStatus);
  const runSchedulerJob = useStore((s: any) => s.runSchedulerJob);
  const schedulerRunning = autonomyStatus?.scheduler?.running === true;

  const items = useMemo(() => {
    const jobs: any[] = autonomyStatus?.scheduler?.jobs || [];
    return [...jobs]
      .sort((a, b) => {
        const ta = a.next_run_time ? new Date(a.next_run_time).getTime() : Number.MAX_SAFE_INTEGER;
        const tb = b.next_run_time ? new Date(b.next_run_time).getTime() : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      })
      .slice(0, 8);
  }, [autonomyStatus]);

  if (!schedulerRunning) {
    return (
      <div style={{ padding: 20, fontSize: 12, color: 'var(--fg-3)' }} className="mono">
        Scheduler kapalı — Otonom modu aç veya backend&apos;i başlat.
      </div>
    );
  }

  if (!items.length) {
    return (
      <div style={{ padding: 20, fontSize: 12, color: 'var(--fg-3)' }} className="mono">
        Zamanlanmış iş yok.
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {items.map((job) => {
        const agentId = JOB_AGENT_HINT[job.id] || 'supervisor';
        const agent = AGENT_BY_ID[agentId];
        const when = job.next_run_time
          ? new Date(job.next_run_time).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
          : '—';
        const last = job.last_run?.summary || job.last_run?.status;
        return (
          <div key={job.id} className="row" style={{ gridTemplateColumns: '48px 22px 1fr auto' }}>
            <span className="mono" style={{ color: 'var(--fg-3)', fontSize: 11 }}>{when}</span>
            <AgentAvatar agent={agent} size={20} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{job.id}</div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
                {agent?.name || agentId}
                {last ? ` · ${String(last).slice(0, 40)}` : ''}
              </div>
            </div>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => void runSchedulerJob(job.id)}
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
// DASHBOARD page
// ============================================================
const DashboardActions = ({
  dash,
  kT,
  loadDemoFixtures,
  onRefresh,
  quickAsk,
  toggleSupervisorDock,
  compact = false,
}: any) => (
  <div className={`page__actions ${compact ? 'page__actions--compact' : ''}`}>
    {dash.isDemo && kT?.sales?.source !== 'backend' && (
      <button
        className="btn btn--ghost btn--sm"
        onClick={() => {
          loadDemoFixtures();
          requestAnimationFrame(() => {
            window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
            document.querySelector('main')?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
          });
        }}
        title="Sahte rakamlarla dashboard'u doldurur"
      >
        <Icon name="sparkles" size={12} /> {compact ? 'Demo' : 'Demo verisi yükle'}
      </button>
    )}
    <button className="btn btn--ghost btn--sm" onClick={onRefresh}>
      <Icon name="refresh" size={12} /> Yenile
    </button>
    {!compact && (
      <button className="btn btn--sm" onClick={() => quickAsk('Bugün için günün planını çıkar: öncelikli görevler, riskler ve atılması gereken aksiyonlar.')}>
        <Icon name="flow" size={12} /> Günü Planla
      </button>
    )}
    <button className="btn btn--primary btn--sm" onClick={() => toggleSupervisorDock()}>
      <Icon name="zap" size={12} /> Komut
      {!compact && <span className="btn__kbd">⌘K</span>}
    </button>
  </div>
);

const DashboardPage = ({ embedded = false }: { embedded?: boolean; navigate?: (p: string) => void }) => {
  const dash = useAdaptedDashboard();
  const k = dash?.kpis ?? {};
  const kT = dash.kpisT;
  const quickAsk = useStore((s: any) => s.quickAsk);
  const refreshDashboard = useStore((s: any) => s.refreshDashboard);
  const loadDemoFixtures = useStore((s: any) => s.loadDemoFixtures);
  const pingBackend = useStore((s: any) => s.pingBackend);
  const loadTools = useStore((s: any) => s.loadTools);
  const toggleSupervisorDock = useStore((s: any) => s.toggleSupervisorDock);
  const onRefresh = async () => {
    await Promise.all([pingBackend(), loadTools(), refreshDashboard(), useStore.getState().loadAutonomyStatus(), useStore.getState().loadTasksFromBackend()]);
  };
  const safeArr = (a: unknown) => (Array.isArray(a) ? a : []);
  const trend = safeArr(k.salesTrendNums).length ? k.salesTrendNums! : new Array(7).fill(0);
  const ordersTrend = safeArr(k.ordersTrendNums).length ? k.ordersTrendNums! : new Array(7).fill(0);
  const roasTrend = safeArr(k.roasTrendNums).length ? k.roasTrendNums! : new Array(7).fill(0);
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
    <div className={`page ${embedded ? 'hub-embedded-page' : ''}`}>
      {!embedded && (
        <>
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
                    title="Demo verisi yüklü. Yenile ile gerçek sipariş verisine dönebilirsiniz."
                    style={{ background: 'rgba(255,177,61,0.10)', color: 'var(--amber)', border: '1px solid rgba(255,177,61,0.4)' }}
                  >
                    demo verisi
                  </span>
                )}
              </h1>
              <p className="page__sub">
                Sistem genel durumu — KPI'lar envanter siparişlerinden türetilir, 30 sn'de bir yenilenir.
              </p>
            </div>
            <DashboardActions
              dash={dash}
              kT={kT}
              loadDemoFixtures={loadDemoFixtures}
              onRefresh={onRefresh}
              quickAsk={quickAsk}
              toggleSupervisorDock={toggleSupervisorDock}
            />
          </div>
        </>
      )}
      {embedded && (
        <div className="page__toolbar">
          <DashboardActions
            dash={dash}
            kT={kT}
            loadDemoFixtures={loadDemoFixtures}
            onRefresh={onRefresh}
            quickAsk={quickAsk}
            toggleSupervisorDock={toggleSupervisorDock}
            compact
          />
        </div>
      )}

      <AlertBanner />

      <div className="grid grid--4">
        <KpiTile
          label="Bugünkü Satış"
          icon="money"
          value={k.sales ?? 0}
          delta={fmtDelta(salesDelta)}
          deltaDir={dirOf(salesDelta)}
          sub={hasSales ? `son 7 gün toplam: ₺${total7d.toLocaleString('tr-TR')}` : 'satış verisi yok'}
          trend={trend}
          color="var(--acid)"
          telemetry={kT?.sales}
        />
        <KpiTile
          label="Siparişler"
          icon="bag"
          value={k.orders ?? 0}
          delta={fmtDelta(ordersDelta)}
          deltaDir={dirOf(ordersDelta)}
          sub="bugün"
          trend={ordersTrend}
          color="var(--cyan)"
          telemetry={kT?.orders}
        />
        <KpiTile
          label="ROAS"
          icon="activity"
          value={k.roas ?? 0}
          delta={fmtDelta(roasDelta)}
          deltaDir={dirOf(roasDelta)}
          sub="hedef 3.5x"
          trend={roasTrend}
          color="var(--violet)"
          telemetry={kT?.roas}
        />
        <KpiTile
          label="Dönüşüm"
          icon="growth"
          value={k.conversion ?? 0}
          delta="—"
          deltaDir="flat"
          sub="kampanya bazlı"
          trend={ordersTrend.map((o: number, i: number) => (trend[i] > 0 ? (o / trend[i]) * 100 : 0))}
          color="var(--amber)"
          telemetry={kT?.conversion}
        />
      </div>

      <div className="hub-layout hub-layout--2-1">
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

      <div className="hub-layout hub-layout--2-1">
        <div className="panel">
          <div className="panel__head">
            <h3>Otonom Hedefler</h3>
            <span className="panel__head-tag">GOAL LOOP</span>
          </div>
          <GoalsProgressPanel />
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
