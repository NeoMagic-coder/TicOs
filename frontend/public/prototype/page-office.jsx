/* global React, AOSWidgets, AGENT_OS_DATA */
// ============================================================
// AGENT.OS — Agent Office page
// 22 agents grouped by layer · live status · scheduled tasks
// ============================================================
const { useState, useEffect, useRef, useMemo } = React;
const { Icon, StatusDot, AgentAvatar, Sparkline } = window.AOSWidgets;
const { AGENTS, LAYER_LABELS, SCHEDULED, AGENT_BY_ID } = window.AGENT_OS_DATA;

// Tiny per-agent fake telemetry trend
const trendFor = (a) => {
  const seed = a.pid.charCodeAt(2);
  return Array.from({ length: 12 }, (_, i) => {
    return 20 + ((seed * 7 + i * (seed % 11 + 3)) % 70) + Math.sin(i + seed) * 5;
  });
};

// ----- Agent card -----
const AgentCard = ({ agent, onSelect, selected }) => {
  const data = trendFor(agent);
  return (
    <div
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
        <span className="mono" style={{ fontSize: 10, color: 'var(--fg-4)' }}>· conf {agent.conf.toFixed(2)}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 10, marginBottom: 8 }} className="mono">
        <div>
          <div style={{ color: 'var(--fg-4)' }}>GÖREV</div>
          <div className="tnum" style={{ color: 'var(--fg-2)', fontSize: 12 }}>{agent.tasks}</div>
        </div>
        <div>
          <div style={{ color: 'var(--fg-4)' }}>YÜK</div>
          <div className="tnum" style={{ color: 'var(--fg-2)', fontSize: 12 }}>{agent.load}%</div>
        </div>
        <div>
          <div style={{ color: 'var(--fg-4)' }}>TOOL</div>
          <div className="tnum" style={{ color: 'var(--fg-2)', fontSize: 12 }}>{agent.tools}</div>
        </div>
      </div>

      <div style={{ height: 24, marginLeft: -2, marginRight: -2 }}>
        <Sparkline data={data} color={agent.accent} width={188} height={24} />
      </div>

      <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        son tool: <span style={{ color: 'var(--cyan)' }}>{agent.lastTool}</span>
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
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(AGENTS[0]);

  const grouped = useMemo(() => {
    const byLayer = {};
    AGENTS.forEach(a => {
      if (filter !== 'all' && a.status !== filter) return;
      const key = a.layer;
      if (!byLayer[key]) byLayer[key] = [];
      byLayer[key].push(a);
    });
    return byLayer;
  }, [filter]);

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
            <span className="page__title-tag">22 PROCESS</span>
          </h1>
          <p className="page__sub">
            Tüm ajanlar, durumları ve canlı yükleri. Hermes orkestratörü görevleri burada dağıtır.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost"><Icon name="refresh" size={12} /> Senkron</button>
          <button className="btn"><Icon name="plus" size={12} /> Ajan Önerisi</button>
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
            ortalama yük <span style={{ color: 'var(--fg-1)' }}>{Math.round(AGENTS.reduce((s,a)=>s+a.load,0)/AGENTS.length)}%</span>
          </span>
        </div>
      </div>

      {/* Layered grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
        <div>
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
              <span className="panel__head-tag">CRON</span>
            </div>
            <div style={{ padding: '4px 0' }}>
              {SCHEDULED.map(s => {
                const a = AGENT_BY_ID[s.owner];
                return (
                  <div key={s.name} style={{
                    padding: '10px 14px',
                    borderBottom: '1px solid var(--border-faint)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      {a && <AgentAvatar agent={a} size={16} />}
                      <span className="mono" style={{ fontSize: 11, color: 'var(--fg-1)' }}>{s.name}</span>
                      <span style={{ marginLeft: 'auto' }} className="mono">
                        <button className="btn btn--sm btn--ghost"><Icon name="play" size={10} /></button>
                      </span>
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{s.cron}</span>
                      <span>{s.dur}</span>
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--fg-4)', marginTop: 2 }}>→ {s.next}</div>
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
                    <div className="mono tnum" style={{ fontSize: 13, color: 'var(--fg-1)' }}>{selected.conf.toFixed(2)}</div>
                  </div>
                  <div>
                    <div className="label-eyebrow" style={{ marginBottom: 4 }}>Bugünki</div>
                    <div className="mono tnum" style={{ fontSize: 13, color: 'var(--fg-1)' }}>{selected.tasks}</div>
                  </div>
                  <div>
                    <div className="label-eyebrow" style={{ marginBottom: 4 }}>Tool sayısı</div>
                    <div className="mono tnum" style={{ fontSize: 13, color: 'var(--fg-1)' }}>{selected.tools}</div>
                  </div>
                </div>

                <div className="label-eyebrow" style={{ marginBottom: 4 }}>Yük</div>
                <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 2, marginBottom: 12 }}>
                  <div style={{ width: selected.load + '%', height: '100%', background: selected.accent, borderRadius: 2 }} />
                </div>

                <div className="label-eyebrow" style={{ marginBottom: 4 }}>Son tool</div>
                <div className="mono" style={{
                  fontSize: 11, padding: '6px 8px',
                  background: 'var(--bg-inset)', border: '1px solid var(--border-faint)',
                  borderRadius: 3, color: 'var(--cyan)',
                  marginBottom: 12,
                }}>{selected.lastTool}()</div>

                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn--sm" style={{ flex: 1 }}><Icon name="play" size={10} /> Görev Ver</button>
                  <button className="btn btn--sm btn--ghost"><Icon name="pause" size={10} /></button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

window.AOSPages = window.AOSPages || {};
window.AOSPages.Office = OfficePage;
