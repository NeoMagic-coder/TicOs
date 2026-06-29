// @ts-nocheck
// ============================================================
// AGENT.OS — Autonomy Console
//   Left:   live agent roster with pulse on agent_started / agent_completed
//   Mid:    DAG visualisation built from plan_ready + completion events
//   Right:  audit log of tool_called events + total cost meter
//   Top:    AutonomyPolicy sliders (PATCH /api/v1/autonomy/policy)
// ============================================================
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/stores/useStore';
import { BASE_URL, backendHeaders } from '@/lib/api';
import { pushToast } from '@/components/AOS/Toast';

const MAX_COST_USD = 5.0;

type Policy = {
  max_price_change_pct: number;
  carrier_switch_max_cost_try: number;
  min_confidence: number;
  risk_auto_threshold: number;
};

const DEFAULT_POLICY: Policy = {
  max_price_change_pct: 5,
  carrier_switch_max_cost_try: 500,
  min_confidence: 0.75,
  risk_auto_threshold: 0.3,
};

// ---------------- Policy sliders ----------------
const PolicyBar = () => {
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [saving, setSaving] = useState<string | null>(null);
  const debounceRef = useRef<Record<string, any>>({});

  useEffect(() => {
    fetch(`${BASE_URL}/api/v1/autonomy/policy`, { headers: backendHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => p && setPolicy((cur) => ({ ...cur, ...p })))
      .catch(() => {});
  }, []);

  const patch = (key: keyof Policy, val: number) => {
    setPolicy((cur) => ({ ...cur, [key]: val }));
    clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(async () => {
      setSaving(key);
      try {
        await fetch(`${BASE_URL}/api/v1/autonomy/policy`, {
          method: 'PATCH',
          headers: backendHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ [key]: val }),
        });
      } finally {
        setSaving(null);
      }
    }, 280);
  };

  const Slider = ({ k, label, min, max, step, fmt }: any) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 220, flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <span style={{ color: 'var(--fg-2)' }}>{label}</span>
        <span className="mono tnum" style={{ color: saving === k ? 'var(--amber)' : 'var(--acid)' }}>
          {fmt(policy[k])}
          {saving === k ? ' ↻' : ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={policy[k]}
        onChange={(e) => patch(k, Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--violet, #8c64dc)' }}
      />
    </div>
  );

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div className="panel__body" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 140 }}>
          <span className="label-eyebrow" style={{ color: 'var(--fg-3)' }}>AUTONOMY POLICY</span>
          <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>PATCH /autonomy/policy</span>
        </div>
        <Slider k="max_price_change_pct" label="Max Price Change %" min={0} max={10} step={0.1} fmt={(v: number) => `${v.toFixed(1)}%`} />
        <Slider k="risk_auto_threshold" label="Risk Auto Threshold" min={0} max={1} step={0.01} fmt={(v: number) => v.toFixed(2)} />
        <Slider k="min_confidence" label="Min Confidence" min={0} max={1} step={0.01} fmt={(v: number) => v.toFixed(2)} />
      </div>
    </div>
  );
};

// ---------------- Agent roster ----------------
const AgentRoster = ({ liveIds }: { liveIds: Set<string> }) => {
  const agents = useStore((s: any) => s.agents);
  return (
    <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="panel__head">
        <span className="label-eyebrow">AJANLAR · {agents.length}</span>
      </div>
      <div className="panel__body" style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
        {agents.map((a: any) => {
          const id = a.agent_id;
          const live = liveIds.has(id);
          return (
            <div
              key={id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                borderRadius: 4, marginBottom: 4,
                background: live ? 'rgba(140,100,220,0.08)' : 'transparent',
                border: `1px solid ${live ? 'rgba(140,100,220,0.3)' : 'transparent'}`,
              }}
            >
              <div
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: a.color || '#444', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, position: 'relative', flexShrink: 0,
                }}
              >
                {a.icon || '🤖'}
                {live && (
                  <span
                    className="pulse-dot"
                    style={{
                      position: 'absolute', top: -2, right: -2, width: 8, height: 8,
                      borderRadius: '50%', background: 'var(--acid)',
                    }}
                  />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: 'var(--fg-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {a.name}
                </div>
                <div className="mono" style={{ fontSize: 9, color: live ? 'var(--acid)' : 'var(--fg-4)' }}>
                  {live ? '● ŞU AN GÖREVDE' : a.agent_id}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes pulse-anim {
          0% { box-shadow: 0 0 0 0 rgba(126, 232, 87, 0.7); }
          70% { box-shadow: 0 0 0 8px rgba(126, 232, 87, 0); }
          100% { box-shadow: 0 0 0 0 rgba(126, 232, 87, 0); }
        }
        .pulse-dot { animation: pulse-anim 1.4s infinite; }
      `}</style>
    </div>
  );
};

// ---------------- DAG ----------------
type DagMeta = { confidence?: number; cost_usd?: number };
type DagState = {
  primary: string | null;
  supporting: string[];
  completed: Set<string>;
  running: Set<string>;
  meta: Record<string, DagMeta>;
};

const DagPanel = ({ dag, autoCount }: { dag: DagState; autoCount: number }) => {
  const nodes: { id: string; role: 'primary' | 'support'; x: number; y: number }[] = [];
  if (dag.primary) nodes.push({ id: dag.primary, role: 'primary', x: 50, y: 50 });
  const n = dag.supporting.length;
  dag.supporting.forEach((id, i) => {
    const angle = (-Math.PI / 2) + (Math.PI * (i + 1)) / (n + 1);
    nodes.push({
      id, role: 'support',
      x: 50 + Math.cos(angle) * 36,
      y: 50 + Math.sin(angle) * 36,
    });
  });

  const colorFor = (id: string) => {
    if (dag.completed.has(id)) return '#7ee857';
    if (dag.running.has(id)) return '#8c64dc';
    return '#444';
  };

  return (
    <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="panel__head">
        <span className="label-eyebrow">GÖREV DAG'I</span>
        <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>
          {dag.primary ? `primary=${dag.primary}` : 'plan_ready bekleniyor…'}
        </span>
      </div>
      <div className="panel__body" style={{ flex: 1, position: 'relative', minHeight: 360 }}>
        {!dag.primary ? (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-4)', fontSize: 12 }}>
            Bir görev başlat → DAG burada görünecek.
          </div>
        ) : (
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%' }}>
            {nodes.filter((n) => n.role === 'support').map((n) => (
              <line key={`l-${n.id}`} x1={50} y1={50} x2={n.x} y2={n.y}
                stroke={dag.completed.has(n.id) ? '#7ee857' : '#3a3a3a'} strokeWidth={0.35} />
            ))}
            {nodes.map((node) => {
              const c = colorFor(node.id);
              const r = node.role === 'primary' ? 7 : 5;
              const meta = dag.meta[node.id] || {};
              const confTxt = typeof meta.confidence === 'number' ? meta.confidence.toFixed(2) : '—';
              const costTxt = typeof meta.cost_usd === 'number' ? `$${meta.cost_usd.toFixed(4)}` : '$0.0000';
              const state = dag.completed.has(node.id) ? 'completed' : dag.running.has(node.id) ? 'running' : 'waiting';
              return (
                <g key={node.id}>
                  <title>{`${node.id} · ${state} · confidence=${confTxt} · cost=${costTxt}`}</title>
                  <circle
                    cx={node.x} cy={node.y} r={r}
                    fill={c}
                    stroke={dag.running.has(node.id) ? '#fff' : 'none'}
                    strokeWidth={0.3}
                    opacity={dag.completed.has(node.id) ? 1 : 0.85}
                  >
                    {dag.running.has(node.id) && (
                      <animate attributeName="r" values={`${r};${r + 1.5};${r}`} dur="1.2s" repeatCount="indefinite" />
                    )}
                  </circle>
                  <text x={node.x} y={node.y + r + 3.2} fontSize={2.4} textAnchor="middle" fill="#cfcfcf">
                    {node.id.replace('_agent', '')}
                  </text>
                  {typeof meta.confidence === 'number' && (
                    <text x={node.x} y={node.y + r + 6.0} fontSize={1.8} textAnchor="middle" fill="#7ee857">
                      conf {confTxt}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        )}
      </div>
      <div className="panel__body" style={{ borderTop: '1px solid var(--border-faint)', padding: 8, display: 'flex', gap: 12, fontSize: 10, alignItems: 'center' }}>
        <span><span style={{ color: '#7ee857' }}>●</span> tamamlandı</span>
        <span><span style={{ color: '#8c64dc' }}>●</span> çalışıyor</span>
        <span><span style={{ color: '#666' }}>●</span> bekliyor</span>
        <span style={{ marginLeft: 'auto', color: 'var(--acid)' }}>{autoCount} otomatik karar / gün</span>
      </div>
    </div>
  );
};

// ---------------- Audit + cost meter ----------------
type ToolEntry = { ts: number; tool_id: string; agent_id: string; cost_usd: number; duration_ms: number; image_url?: string };

const AuditPanel = ({ entries, totalCost }: { entries: ToolEntry[]; totalCost: number }) => {
  const pct = Math.min(100, (totalCost / MAX_COST_USD) * 100);
  const color = pct < 60 ? 'var(--acid)' : pct < 90 ? 'var(--amber)' : '#ef4444';
  return (
    <div className="panel" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="panel__head" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="label-eyebrow">AUDIT · TOOL CALLS</span>
          <span className="mono tnum" style={{ fontSize: 10, color }}>
            ${totalCost.toFixed(4)} / ${MAX_COST_USD.toFixed(2)}
          </span>
        </div>
        <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 300ms ease' }} />
        </div>
      </div>
      <div className="panel__body" style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {entries.length === 0 && (
          <div style={{ color: 'var(--fg-4)', fontSize: 11, textAlign: 'center', paddingTop: 20 }}>
            Henüz tool çağrısı yok.
          </div>
        )}
        {entries.slice().reverse().map((e, i) => (
          <div
            key={`${e.ts}-${i}`}
            style={{
              margin: '0 0 6px 0', padding: 8, background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--border-faint)', borderRadius: 4, fontSize: 10,
              color: 'var(--fg-2)',
            }}
          >
            <pre
              className="mono"
              style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 10 }}
            >
{JSON.stringify({
  tool: e.tool_id,
  agent: e.agent_id,
  cost_usd: e.cost_usd,
  latency_ms: e.duration_ms,
  ts: new Date(e.ts).toLocaleTimeString('tr-TR'),
}, null, 2)}
            </pre>
            {e.image_url && (
              <a
                href={`${BASE_URL}${e.image_url}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'block', marginTop: 6 }}
              >
                <img
                  src={`${BASE_URL}${e.image_url}`}
                  alt={`${e.tool_id} output`}
                  style={{
                    width: '100%', maxWidth: 280, borderRadius: 4,
                    border: '1px solid var(--border-faint)',
                  }}
                />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------- Demo Play button ----------------
// Streams /api/v1/demo/play SSE and projects step_started/step_completed
// events onto the existing chatProgress store so the DAG + roster panels
// light up exactly like a real TicOSClaw run. Pitch-time one-tap demo trigger.
const DemoPlayButton = () => {
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<{ auto: number; escalated: number } | null>(null);

  const pushEvent = (
    event: string,
    agent_id?: string,
    tool_id?: string,
    label = '',
    extra: { confidence?: number; cost_usd?: number } = {},
  ) => {
    useStore.setState((s: any) => ({
      chatProgress: [
        ...s.chatProgress,
        { event, agent_id, tool_id, ts: Date.now(), label, ...extra },
      ].slice(-25),
    }));
  };

  const play = async () => {
    if (running) return;
    setRunning(true);
    setSummary(null);
    useStore.setState({ chatProgress: [] });

    try {
      const res = await fetch(`${BASE_URL}/api/v1/demo/play`, {
        method: 'POST',
        headers: backendHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ scenario: '3hour_race', speed_multiplier: 90 }),
      });
      if (!res.body) throw new Error('no body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let primarySet = false;
      const supporting: string[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // SSE frames delimited by \n\n.
        let idx;
        while ((idx = buf.indexOf('\n\n')) !== -1) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const lines = frame.split('\n');
          let evt = '';
          let dataLine = '';
          for (const ln of lines) {
            if (ln.startsWith('event: ')) evt = ln.slice(7).trim();
            else if (ln.startsWith('data: ')) dataLine = ln.slice(6);
          }
          if (!evt) continue;
          let data: any = {};
          try { data = dataLine ? JSON.parse(dataLine) : {}; } catch { /* ignore */ }

          if (evt === 'step_started') {
            const aid = data.agent_id;
            if (!primarySet && aid) {
              primarySet = true;
              pushEvent('plan_ready', undefined, undefined, `primary=${aid}`);
              useStore.setState((s: any) => ({
                chatProgress: [
                  ...s.chatProgress.slice(0, -1),
                  { ...s.chatProgress[s.chatProgress.length - 1], primary: aid, supporting: [] },
                ],
              }));
            } else if (aid && !supporting.includes(aid)) {
              supporting.push(aid);
              useStore.setState((s: any) => {
                const next = [...s.chatProgress];
                const planIdx = next.findIndex((p: any) => p.event === 'plan_ready');
                if (planIdx >= 0) next[planIdx] = { ...next[planIdx], supporting: [...supporting] };
                return { chatProgress: next };
              });
            }
            pushEvent('agent_started', aid, undefined, data.name || aid);
          } else if (evt === 'tool_called') {
            // Synthesize a chatProgress entry + an auditLogs entry so the
            // AuditPanel (which joins the two by tool_id+agent_id) lights up.
            pushEvent('tool_called', data.agent_id, data.tool_id, data.tool_id);
            useStore.setState((s: any) => ({
              auditLogs: [
                ...s.auditLogs,
                {
                  id: `demo_${data.session_id}_${data.idx}_${data.tool_id}_${Date.now()}`,
                  timestamp: new Date().toISOString(),
                  level: 'info',
                  message: `demo.tool_called ${data.tool_id}`,
                  metadata: {
                    tool_id: data.tool_id,
                    agent_id: data.agent_id,
                    cost_usd: data.cost_usd,
                    duration_ms: data.duration_ms,
                    image_url: data.image_url || undefined,
                  },
                },
              ].slice(-200),
            }));
          } else if (evt === 'step_completed') {
            pushEvent('agent_completed', data.agent_id, undefined, data.name || '', {
              confidence: typeof data.confidence === 'number' ? data.confidence : undefined,
              cost_usd: typeof data.cost_usd === 'number' ? data.cost_usd : undefined,
            });
          } else if (evt === 'summary') {
            const s = data.auto_decisions_vs_escalations || {};
            setSummary({ auto: s.auto ?? 0, escalated: s.escalated ?? 0 });
          } else if (evt === 'order_received') {
            pushToast({
              kind: 'success',
              title: 'Sipariş alındı',
              body: `${data.marketplace || 'trendyol'} · #${data.order_id} · ₺${Number(data.amount_try || 0).toFixed(2)} · ${data.buyer || ''}`,
            });
          }
        }
      }
    } catch (e) {
    } finally {
      setRunning(false);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button
        className="btn btn--primary"
        onClick={play}
        disabled={running}
        title="3 saatlik otonom yarış senaryosunu DAG + audit panellerine yansıtarak ~2 dk'da oynat."
      >
        {running ? '▶ Oynatılıyor…' : '▶ Demo Oynat'}
      </button>
      {summary && (
        <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
          <span style={{ color: 'var(--acid)' }}>{summary.auto} otonom</span>
          {' · '}
          <span style={{ color: 'var(--amber)' }}>{summary.escalated} yükseltilmiş</span>
        </span>
      )}
    </div>
  );
};

// ---------------- Autonomy mode + scheduler ----------------
const ModeSchedulerBar = () => {
  const autonomyStatus = useStore((s: any) => s.autonomyStatus);
  const autonomyEnabled = useStore((s: any) => s.autonomyEnabled);
  const setAutonomyEnabled = useStore((s: any) => s.setAutonomyEnabled);
  const patchAutonomyMode = useStore((s: any) => s.patchAutonomyMode);
  const runAutonomySweep = useStore((s: any) => s.runAutonomySweep);
  const runGoalLoopTick = useStore((s: any) => s.runGoalLoopTick);
  const loadAutonomyStatus = useStore((s: any) => s.loadAutonomyStatus);

  useEffect(() => {
    void loadAutonomyStatus();
    const id = setInterval(() => void loadAutonomyStatus(), 45000);
    return () => clearInterval(id);
  }, [loadAutonomyStatus]);

  const mode = autonomyStatus?.mode || {};
  const goalLoop = autonomyStatus?.goal_loop || {};
  const jobs: any[] = autonomyStatus?.scheduler?.jobs || [];
  const pendingLow = autonomyStatus?.pending_low_risk ?? 0;
  const pendingTotal = autonomyStatus?.pending_approvals ?? 0;

  const Toggle = ({ k, label }: { k: string; label: string }) => (
    <button
      type="button"
      className={`btn btn--sm ${mode[k] ? 'btn--primary' : 'btn--ghost'}`}
      onClick={() => void patchAutonomyMode({ [k]: !mode[k] })}
    >
      {label}
    </button>
  );

  return (
    <div className="hub-layout hub-layout--1-1" style={{ marginBottom: 12 }}>
      <div className="panel">
        <div className="panel__head spread">
          <h3>Otonom Mod</h3>
          <span className={`chip ${autonomyEnabled ? 'chip--acid' : ''}`}>
            {autonomyEnabled ? 'AKTİF' : 'KAPALI'}
          </span>
        </div>
        <div className="panel__body col-flex">
          <div className="page-toolbar">
            <button
              type="button"
              className={`btn btn--sm ${autonomyEnabled ? 'btn--primary' : ''}`}
              onClick={() => void setAutonomyEnabled(!autonomyEnabled)}
            >
              {autonomyEnabled ? 'Otonom modu kapat' : 'Otonom modu aç'}
            </button>
            <Toggle k="auto_sync" label="Otomatik sync" />
            <Toggle k="auto_brief" label="Günlük brief" />
            <Toggle k="auto_approve_low_risk" label="Düşük risk onay" />
            <Toggle k="auto_goal_loop" label="Hedef döngüsü" />
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => void runAutonomySweep()}>
              Şimdi tara
            </button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => void runGoalLoopTick()}>
              Hedef tick
            </button>
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
            {pendingTotal} bekleyen onay · {pendingLow} düşük risk
            {goalLoop.stale_count != null && <> · {goalLoop.stale_count} stale hedef</>}
            {autonomyStatus?.next_job?.next_run_time && (
              <> · sonraki iş {new Date(autonomyStatus.next_job.next_run_time).toLocaleString('tr-TR')}</>
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel__head">
          <h3>Zamanlanmış İşler</h3>
          <span className="panel__head-tag">{jobs.length} job</span>
        </div>
        <div className="panel__body" style={{ padding: 0, maxHeight: 220, overflowY: 'auto' }}>
          <table className="table" style={{ fontSize: 11 }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Sonraki</th>
                <th>Son çalışma</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td className="mono">{j.id}</td>
                  <td className="mono tnum">
                    {j.next_run_time
                      ? new Date(j.next_run_time).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
                      : '—'}
                  </td>
                  <td className="mono" style={{ color: 'var(--fg-3)' }}>
                    {j.last_run?.summary || j.last_run?.status || '—'}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', color: 'var(--fg-4)', padding: 16 }}>
                    Scheduler kapalı veya backend offline
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ---------------- Page ----------------
const AutonomyConsolePage = ({ embedded = false }: { embedded?: boolean; navigate?: (p: string) => void }) => {
  const chatProgress = useStore((s: any) => s.chatProgress);
  const auditLogs = useStore((s: any) => s.auditLogs);
  const tasks = useStore((s: any) => s.tasks);

  // Derive DAG + live agents from streaming chatProgress.
  const dag: DagState = useMemo(() => {
    const state: DagState = { primary: null, supporting: [], completed: new Set(), running: new Set(), meta: {} };
    for (const p of chatProgress) {
      if (p.event === 'plan_ready') {
        state.primary = (p as any).primary ?? state.primary;
        const sup = (p as any).supporting;
        if (Array.isArray(sup)) state.supporting = sup;
      } else if (p.event === 'agent_started' && p.agent_id) {
        state.running.add(p.agent_id);
      } else if (p.event === 'agent_completed' && p.agent_id) {
        state.running.delete(p.agent_id);
        state.completed.add(p.agent_id);
        const prev = state.meta[p.agent_id] || {};
        state.meta[p.agent_id] = {
          confidence: typeof (p as any).confidence === 'number' ? (p as any).confidence : prev.confidence,
          cost_usd: typeof (p as any).cost_usd === 'number' ? (p as any).cost_usd : prev.cost_usd,
        };
      } else if (p.event === 'node_injected' && (p as any).agent_id) {
        const aid = (p as any).agent_id as string;
        if (!state.supporting.includes(aid)) state.supporting = [...state.supporting, aid];
      }
    }
    return state;
  }, [chatProgress]);

  const autoDecisionCount = useMemo(() => {
    let n = 0;
    for (const p of chatProgress) {
      if (p.event === 'agent_completed' && p.agent_id) n += 1;
    }
    return n;
  }, [chatProgress]);

  const liveAgentIds = dag.running;

  // Tool-call entries: SSE events only carry agent_id + tool_id, so we enrich
  // cost / latency from the persisted audit log when available.
  const toolEntries: ToolEntry[] = useMemo(() => {
    const out: ToolEntry[] = [];
    for (const p of chatProgress) {
      if (p.event !== 'tool_called' || !p.tool_id) continue;
      // Newest matching audit entry wins — multiple demo runs append entries
      // and we want the latest payload (e.g. fresh image_url) per call.
      const matches = auditLogs.filter(
        (l: any) => (l.metadata as any)?.tool_id === p.tool_id && (l.metadata as any)?.agent_id === p.agent_id,
      );
      const match = matches[matches.length - 1];
      const md = (match?.metadata as any) || {};
      out.push({
        ts: p.ts,
        tool_id: p.tool_id,
        agent_id: p.agent_id || '—',
        cost_usd: typeof md.cost_usd === 'number' ? md.cost_usd : 0,
        duration_ms: typeof md.duration_ms === 'number' ? md.duration_ms : 0,
        image_url: typeof md.image_url === 'string' ? md.image_url : undefined,
      });
    }
    // Also include tools from completed tasks not yet in chatProgress.
    for (const t of tasks) {
      const calls = (t as any).tools_called || [];
      for (const c of calls) {
        if (out.some((o) => o.tool_id === c.tool_id && o.agent_id === c.agent_id)) continue;
        out.push({
          ts: new Date((t as any).completed_at || (t as any).started_at || Date.now()).getTime(),
          tool_id: c.tool_id,
          agent_id: c.agent_id,
          cost_usd: c.cost_usd || 0,
          duration_ms: c.duration_ms || 0,
        });
      }
    }
    return out;
  }, [chatProgress, auditLogs, tasks]);

  const totalCost = toolEntries.reduce((acc, e) => acc + (e.cost_usd || 0), 0);

  return (
    <div className={`page ${embedded ? 'hub-embedded-page' : ''}`}>
      {!embedded && (
        <div className="page__breadcrumb mono">HOME <span>›</span> AUTONOMY CONSOLE</div>
      )}
      <div className="page__header">
        {!embedded && (
          <div>
            <h1 className="page__title">Autonomy Console</h1>
            <p className="page__sub">Canlı ajan nabzı, scheduler, policy ve audit — tek ekranda.</p>
          </div>
        )}
        <DemoPlayButton />
      </div>

      <ModeSchedulerBar />
      <PolicyBar />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr 360px',
          gap: 12,
          minHeight: 'calc(100vh - 320px)',
        }}
      >
        <AgentRoster liveIds={liveAgentIds} />
        <DagPanel dag={dag} autoCount={autoDecisionCount} />
        <AuditPanel entries={toolEntries} totalCost={totalCost} />
      </div>
    </div>
  );
};

export default AutonomyConsolePage;
