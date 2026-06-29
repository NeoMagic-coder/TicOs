// @ts-nocheck
// ============================================================
// AGENT.OS — Agent Office page
// 22 agents grouped by layer · live status · scheduled tasks
// ============================================================
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icon, StatusDot, AgentAvatar } from '@/components/AOS/widgets';
import { LAYER_LABELS, AGENT_BY_ID } from '@/data/aos/mockData';
import { useAdaptedAgents } from '@/lib/aos/adapter';
import { useStore } from '@/stores/useStore';
import { BASE_URL } from '@/lib/api';
import { pushToast } from '@/components/AOS/Toast';

// ----- Agent card -----
const AgentCard = ({ agent, onSelect, selected }) => {
  const fmtPct = (v: number | null) => (v == null ? '—' : `${Math.round(v)}%`);
  const fmtConf = (v: number | null) => (v == null ? '—' : v.toFixed(2));
  return (
    <div
      className="cursor-pointer"
      onClick={() => onSelect(agent)}
      style={{
        background: selected ? 'var(--bg-2)' : 'var(--bg-1)',
        border: `1px solid ${selected ? agent.accent : 'var(--border)'}`,
        borderRadius: 5,
        padding: 14,
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: agent.accent,
        opacity: agent.status === 'idle' ? 0.2 : 0.85,
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <AgentAvatar agent={agent} size={32} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>{agent.name}</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.role}</div>
        </div>
        <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)' }}>{agent.pid}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <StatusDot status={agent.status} size={6} />
        <span className="mono" style={{
          fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
          color: agent.status === 'running' ? 'var(--acid)' : agent.status === 'busy' ? 'var(--amber)' : 'var(--fg-3)',
        }}>{agent.status}</span>
        {agent.conf != null && (
          <span className="mono" style={{ fontSize: 10, color: 'var(--fg-4)' }}>· conf {fmtConf(agent.conf)}</span>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 10, marginBottom: 8 }} className="mono">
        <div>
          <div style={{ color: 'var(--fg-4)' }}>GÖREV</div>
          <div className="tnum" style={{ color: agent.tasks != null ? 'var(--fg-2)' : 'var(--fg-4)', fontSize: 12 }}>
            {agent.tasks != null ? agent.tasks : '—'}
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--fg-4)' }}>YÜK</div>
          <div className="tnum" style={{ color: agent.load != null ? 'var(--fg-2)' : 'var(--fg-4)', fontSize: 12 }}>
            {fmtPct(agent.load)}
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--fg-4)' }}>TOOL</div>
          <div
            className="tnum"
            style={{ color: 'var(--fg-2)', fontSize: 12, display: 'inline-flex', alignItems: 'baseline', gap: 4 }}
            title={agent.tools_live != null ? `${agent.tools_live} live · ${agent.tools_mock} mock` : undefined}
          >
            {agent.tools}
            {agent.tools_live != null && agent.tools > 0 && (
              <span className="mono" style={{ fontSize: 9, color: 'var(--acid)' }}>
                ({agent.tools_live}L)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {agent.lastTool ? (
          agent.status === 'running' || agent.status === 'busy' ? (
            <>şu an: <span style={{ color: 'var(--cyan)' }}>{agent.lastTool}()</span></>
          ) : (
            <>son aktivite <span style={{ color: 'var(--cyan)' }}>{agent.lastTool}</span></>
          )
        ) : (
          <span style={{ color: 'var(--fg-4)' }}>son aktivite — yok</span>
        )}
      </div>
    </div>
  );
};

const STATUS_FILTERS = [
  { id: 'all',     label: 'Tümü',      color: 'var(--fg-2)' },
  { id: 'running', label: 'Çalışıyor', color: 'var(--acid)' },
  { id: 'busy',    label: 'Meşgul',    color: 'var(--amber)' },
  { id: 'idle',    label: 'Boşta',     color: 'var(--fg-3)' },
];

const OfficePage = () => {
  const AGENTS = useAdaptedAgents();
  const hasAgents = AGENTS.length > 0;

  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<any>(AGENTS[0]);
  useEffect(() => {
    if (!selected && AGENTS.length) setSelected(AGENTS[0]);
  }, [AGENTS, selected]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/v1/agents`, { signal: AbortSignal.timeout(4000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled && Array.isArray(data) && data.length) {
          useStore.setState({ agents: data });
        }
      } catch {
        // Seed agents remain visible via adapter metadata.
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const quickAsk = useStore((s: any) => s.quickAsk);

  // Pull real cron jobs from the backend `/api/v1/automations` endpoint —
  // the previous version rendered a hardcoded `SCHEDULED` mockData list that
  // never reflected the actual scheduler state.
  const [scheduled, setScheduled] = useState<any[]>([]);
  const [scheduledError, setScheduledError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/v1/automations`, { signal: AbortSignal.timeout(4000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const list = await res.json();
        if (!cancelled && Array.isArray(list)) {
          setScheduled(list);
          setScheduledError(null);
        }
      } catch (e: any) {
        if (!cancelled) setScheduledError(e?.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const syncAgents = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/agents`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        useStore.setState({ agents: data });
      }
      pushToast({ kind: 'success', title: 'Senkron tamam', body: `${Array.isArray(data) ? data.length : 0} ajan yüklendi.` });
    } catch (e: any) {
      pushToast({ kind: 'warn', title: 'Senkron başarısız', body: `${e?.message || e} — yerel ajan listesi kullanılıyor.` });
    }
  };
  const suggestAgent = () => {
    quickAsk('Mevcut ürünüm için eksik veya zayıf görünen rolleri tespit et ve önerilen yeni ajanı, gerekçesiyle ve görev tanımıyla birlikte sun.');
  };
  const triggerCron = async (name: string, owner: string) => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/automations`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const list: any[] = await res.json();
        const found = list.find((a) => a?.name === name);
        if (found?.id) {
          await fetch(`${BASE_URL}/api/v1/automations/${found.id}/trigger`, { method: 'POST' });
          pushToast({ kind: 'success', title: 'Görev tetiklendi', body: `${name} şimdi çalışıyor.` });
          return;
        }
      }
      throw new Error('automation not found');
    } catch {
      quickAsk(`${name} zamanlanmış görevini şimdi çalıştır (${owner}).`);
    }
  };

  const grouped = useMemo(() => {
    const byLayer = {};
    AGENTS.forEach(a => {
      if (filter !== 'all' && a.status !== filter) return;
      const key = a.layer;
      if (!byLayer[key]) byLayer[key] = [];
      byLayer[key].push(a);
    });
    return byLayer;
  }, [filter, AGENTS]);

  const counts = {
    all: AGENTS.length,
    running: AGENTS.filter(a => a.status === 'running').length,
    busy: AGENTS.filter(a => a.status === 'busy').length,
    idle: AGENTS.filter(a => a.status === 'idle').length,
  };

  const LAYER_ORDER = ['orchestrator', 'autonomy', 'core', 'growth', 'system'];

  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> AGENT OFFICE</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">
            Agent Office
            <span className="page__title-tag">{AGENTS.length} PROCESS</span>
          </h1>
          <p className="page__sub">
            Tüm ajanlar, durumları ve canlı yükleri. TicOSClaw görevleri burada dağıtır.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost" onClick={syncAgents}><Icon name="refresh" size={12} /> Senkron</button>
          <button className="btn" onClick={suggestAgent}><Icon name="plus" size={12} /> Ajan Önerisi</button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="tabs">
        {STATUS_FILTERS.map(f => (
          <div key={f.id} className={`tab ${filter === f.id ? 'tab--active' : ''}`} onClick={() => setFilter(f.id)}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {f.id !== 'all' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: f.color }} />}
              {f.label}
              <span className="tab__count">{counts[f.id]}</span>
            </span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }} className="mono">
          <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>
            {(() => {
              const loads = AGENTS.map((a: any) => a.load).filter((v: any) => typeof v === 'number');
              if (!loads.length) return <>ortalama yük <span style={{ color: 'var(--fg-4)' }}>—</span></>;
              const avg = Math.round(loads.reduce((s: number, v: number) => s + v, 0) / loads.length);
              return <>ortalama yük <span style={{ color: 'var(--fg-1)' }}>{avg}%</span></>;
            })()}
          </span>
        </div>
      </div>

      {/* Layered grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <div>
          {!hasAgents && (
            <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--fg-3)' }}>
              <div className="mono" style={{ marginBottom: 8 }}>— ajan kaydı yok —</div>
              <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>Backend `/api/v1/agents` boş döndü ya da erişilemiyor. "Senkron" ile yenilemeyi dene.</div>
            </div>
          )}
          {LAYER_ORDER.map(layer => {
            const items = grouped[layer];
            if (!items || items.length === 0) return null;
            return (
              <div key={layer} style={{ marginBottom: 20 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  marginBottom: 10, paddingBottom: 6,
                  borderBottom: '1px solid var(--border-faint)',
                  whiteSpace: 'nowrap',
                }}>
                  <span className="label-eyebrow" style={{ whiteSpace: 'nowrap' }}>{LAYER_LABELS[layer]}</span>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', whiteSpace: 'nowrap' }}>· {items.length} ajan</span>
                  <span style={{ flex: 1, height: 1, background: 'var(--border-faint)' }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                  {items.map(a => (
                    <AgentCard key={a.id} agent={a} onSelect={setSelected} selected={selected?.id === a.id} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right rail: scheduled jobs + selected agent detail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignSelf: 'flex-start', position: 'sticky', top: 0 }}>
          <div className="panel">
            <div className="panel__head">
              <h3>Zamanlanmış</h3>
              <span className="panel__head-tag">CRON · {scheduled.length}</span>
            </div>
            <div style={{ padding: '4px 0' }}>
              {scheduled.length === 0 && (
                <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: 'var(--fg-3)' }} className="mono">
                  {scheduledError ? `automations okunamadı — ${scheduledError}` : '— zamanlanmış cron yok —'}
                </div>
              )}
              {scheduled.map((s: any) => {
                const ownerId = s.owner_agent_id || s.owner || s.agent_id;
                const a = ownerId ? AGENT_BY_ID[ownerId] : null;
                const name = s.name || s.id || 'cron';
                const cronExpr = s.cron || s.schedule || '—';
                const nextRun = s.next_run_at || s.next || null;
                return (
                  <div key={s.id || name} style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border-faint)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      {a && <AgentAvatar agent={a} size={16} />}
                      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-1)' }}>{name}</span>
                      <span style={{ marginLeft: 'auto' }} className="mono">
                        <button
                          className="btn btn--sm btn--ghost"
                          title={`${name} şimdi çalıştır`}
                          onClick={() => triggerCron(name, ownerId || '')}
                        >
                          <Icon name="play" size={10} />
                        </button>
                      </span>
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{cronExpr}</span>
                      {typeof s.last_duration_ms === 'number' && <span>{(s.last_duration_ms / 1000).toFixed(1)}s</span>}
                    </div>
                    {nextRun && (
                      <div className="mono" style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 2 }}>
                        → {typeof nextRun === 'string' && /\d{4}-\d{2}/.test(nextRun)
                          ? new Date(nextRun).toLocaleString('tr-TR', { hour12: false })
                          : nextRun}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {selected && (
            <div className="panel">
              <div className="panel__head">
                <h3>{selected.name}</h3>
                <span className="panel__head-tag">{selected.pid}</span>
              </div>
              <div style={{ padding: 14 }}>
                <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 12 }}>{selected.role}</div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <div className="label-eyebrow" style={{ marginBottom: 4 }}>Durum</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <StatusDot status={selected.status} size={7} />
                      <span style={{ fontSize: 13, color: 'var(--fg-1)' }}>{selected.status}</span>
                    </div>
                  </div>
                  <div>
                    <div className="label-eyebrow" style={{ marginBottom: 4 }}>Conf.</div>
                    <div className="mono tnum" style={{ fontSize: 13, color: selected.conf != null ? 'var(--fg-1)' : 'var(--fg-4)' }}>
                      {selected.conf != null ? selected.conf.toFixed(2) : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="label-eyebrow" style={{ marginBottom: 4 }}>Görev</div>
                    <div className="mono tnum" style={{ fontSize: 13, color: selected.tasks != null ? 'var(--fg-1)' : 'var(--fg-4)' }}>
                      {selected.tasks != null ? selected.tasks : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="label-eyebrow" style={{ marginBottom: 4 }}>Tool sayısı</div>
                    <div className="mono tnum" style={{ fontSize: 13, color: 'var(--fg-1)' }}>{selected.tools}</div>
                  </div>
                </div>

                <div className="label-eyebrow" style={{ marginBottom: 4 }}>
                  Yük {selected.load == null && <span className="mono" style={{ color: 'var(--fg-4)', fontSize: 10, marginLeft: 4 }}>(veri yok)</span>}
                </div>
                <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, marginBottom: 12 }}>
                  <div style={{ width: (selected.load ?? 0) + '%', height: '100%', background: selected.accent, borderRadius: 2 }} />
                </div>

                <h4 style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-3)' }}>
                  Trace — Son Aktivite
                </h4>
                <div className="mono" style={{
                  fontSize: 11, padding: '6px 8px',
                  background: 'var(--bg-inset)', border: '1px solid var(--border-faint)',
                  borderRadius: 3, color: selected.lastTool ? 'var(--cyan)' : 'var(--fg-4)',
                  marginBottom: 12,
                }}>{selected.lastTool ? `${selected.lastTool}()` : '— bu oturumda tool çağrısı kaydedilmedi —'}</div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn btn--sm"
                    style={{ flex: 1 }}
                    onClick={() => quickAsk(`${selected.name} ajanına şu görevi ver: aktif ürün için bugün önceliklendireceği 3 aksiyonu sırala ve ilkini başlat.`)}
                  >
                    <Icon name="play" size={10} /> Görev Ver
                  </button>
                  <button
                    className="btn btn--sm btn--ghost"
                    title="Ajanı duraklat"
                    onClick={() => pushToast({ kind: 'info', title: 'Duraklatma', body: `${selected.name} sıraya girdi (idle).` })}
                  >
                    <Icon name="pause" size={10} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};




export default OfficePage;
