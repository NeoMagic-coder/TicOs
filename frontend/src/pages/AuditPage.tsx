// @ts-nocheck
// ============================================================
// AGENT.OS — Audit Log (terminal-style)
// ============================================================
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icon, AgentAvatar } from '@/components/AOS/widgets';
import { AGENT_BY_ID, AGENTS } from '@/data/aos/mockData';
import { useAdaptedAuditLog } from '@/lib/aos/adapter';
import { useStore } from '@/stores/useStore';

const LEVEL_COLOR = {
  info: 'var(--fg-2)',
  ok:   'var(--acid)',
  warn: 'var(--amber)',
  err:  'var(--rose)',
};

const AuditPage = () => {
  const storeLogs = useAdaptedAuditLog(500);
  const clearAuditLogs = useStore((s: any) => s.clearAuditLogs);
  const [paused, setPaused] = useState(false);
  const [pausedSnapshot, setPausedSnapshot] = useState<any[] | null>(null);
  const [filterLevel, setFilterLevel] = useState('all');
  const [filterAgent, setFilterAgent] = useState('all');
  const [search, setSearch] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const [autoscroll, setAutoscroll] = useState(true);

  // When the user toggles pause we freeze the displayed list — otherwise we
  // always render the live store data (no fake synthesizer any more).
  useEffect(() => {
    if (paused) setPausedSnapshot(storeLogs);
    else setPausedSnapshot(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);
  const events = paused && pausedSnapshot ? pausedSnapshot : storeLogs;

  useEffect(() => {
    if (autoscroll && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [events, autoscroll]);

  const filtered = useMemo(() => {
    return events.filter((e: any) => {
      if (filterLevel !== 'all' && e.level !== filterLevel) return false;
      if (filterAgent !== 'all' && e.agent !== filterAgent) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = [
          e.event,
          e.msg,
          e.agent,
          e.actor_name,
          e.actor_id,
        ]
          .filter(Boolean)
          .map((s: any) => String(s).toLowerCase())
          .join(' ');
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [events, filterLevel, filterAgent, search]);

  // Counts by level over the visible/filtered set so the KPI strip matches
  // the tail's "N / N satır" footer. The previous 60s window drifted out of
  // sync with the rendered list as soon as events fell outside that window.
  const counts = useMemo(() => {
    let ok = 0, warn = 0, err = 0;
    for (const e of filtered) {
      if (e.level === 'ok') ok += 1;
      else if (e.level === 'warn') warn += 1;
      else if (e.level === 'err') err += 1;
    }
    return { total: filtered.length, ok, warn, err };
  }, [filtered]);

  // Recently active = at least one event in the last 5 seconds.
  const isLive = useMemo(() => {
    const cutoff = Date.now() - 5 * 1000;
    return events.some((e: any) => e.timestamp && new Date(e.timestamp).getTime() >= cutoff);
  }, [events]);

  const uniqueAgents = useMemo(() => {
    return Array.from(new Set(events.map((e: any) => e.agent))).filter((a: any) => a);
  }, [events]);

  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> AUDIT LOG</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">
            Audit Log
            <span className="page__title-tag">HERMES.LOG</span>
            <span className={`chip chip--${paused ? '' : isLive ? 'acid' : 'amber'}`} style={paused ? { background: 'transparent', color: 'var(--fg-3)' } : undefined}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: paused ? 'var(--fg-3)' : isLive ? 'var(--acid)' : 'var(--amber)',
              }} />
              {paused ? 'DURAKLATILDI' : isLive ? 'CANLI · tail -f' : 'BEKLEMEDE'}
            </span>
          </h1>
          <p className="page__sub">
            Tüm orkestratör + tool çağrılarının olay akışı. Her satır {events.length > 0 ? 'gerçek store kaydından' : 'henüz hiç structlog gelmedi'} gelir.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn--ghost"
            onClick={() => {
              if (events.length === 0) return;
              if (!confirm(`${events.length} audit satırını temizle?`)) return;
              clearAuditLogs();
            }}
            disabled={events.length === 0}
            title="Store'daki tüm audit log kayıtlarını siler"
          >
            <Icon name="x" size={12} /> Temizle
          </button>
          <button className="btn" onClick={() => setPaused((p) => !p)} disabled={events.length === 0 && !paused}>
            <Icon name={paused ? 'play' : 'pause'} size={12} /> {paused ? 'Devam' : 'Duraklat'}
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 1, background: 'var(--border-faint)',
        border: '1px solid var(--border)', borderRadius: 6,
        marginBottom: 16, overflow: 'hidden',
      }}>
        {[
          { l: 'Olay',        v: counts.total, color: 'var(--fg-1)' },
          { l: 'OK',          v: counts.ok,    color: 'var(--acid)' },
          { l: 'Warn',        v: counts.warn,  color: 'var(--amber)' },
          { l: 'Error',       v: counts.err,   color: 'var(--rose)' },
        ].map(s => (
          <div key={s.l} style={{ padding: '12px 16px', background: 'var(--bg-1)' }}>
            <div className="label-eyebrow" style={{ marginBottom: 4 }}>{s.l}</div>
            <div className="tnum" style={{ fontSize: 20, fontWeight: 500, color: s.color }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--bg-1)', border: '1px solid var(--border)',
          borderRadius: 4, padding: '4px 8px',
        }}>
          <Icon name="search" size={12} color="var(--fg-3)" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="grep…"
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--fg-1)', fontSize: 12, width: 160,
              fontFamily: 'var(--font-mono)',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['all','ok','warn','err','info'].map(l => (
            <button key={l} className="btn btn--sm" onClick={() => setFilterLevel(l)}
              style={{
                background: filterLevel === l ? 'var(--bg-3)' : 'var(--bg-1)',
                color: filterLevel === l ? 'var(--fg-1)' : 'var(--fg-3)',
              }}>
              <span className="mono">{l}</span>
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
        <select
          value={filterAgent}
          onChange={e => setFilterAgent(e.target.value)}
          style={{
            background: 'var(--bg-1)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '6px 8px', fontSize: 11, color: 'var(--fg-1)',
            fontFamily: 'var(--font-mono)', cursor: 'pointer',
          }}
        >
          <option value="all">tüm ajanlar</option>
          {uniqueAgents.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-3)', fontSize: 11 }} className="mono">
          <input type="checkbox" checked={autoscroll} onChange={e => setAutoscroll(e.target.checked)} />
          autoscroll
        </div>
      </div>

      {/* Terminal */}
      <div className="panel" style={{ background: 'var(--bg-inset)' }}>
        <div className="panel__head" style={{ background: 'rgba(0,0,0,0.2)' }}>
          <span style={{ display: 'flex', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--rose)' }} />
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--amber)' }} />
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--acid)' }} />
          </span>
          <h3 className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>hermes@agent.os: ~ tail -f hermes.log</h3>
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--fg-3)' }} className="mono">{filtered.length} / {events.length} satır</span>
        </div>
        <div ref={listRef} style={{
          maxHeight: '52vh',
          overflowY: 'auto',
          padding: '10px 12px',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          lineHeight: 1.55,
        }}>
          {filtered.map((e) => {
            const agent = AGENT_BY_ID[e.agent];
            const levelColor = LEVEL_COLOR[e.level] || 'var(--fg-2)';
            return (
              <div key={e.id} style={{
                display: 'grid',
                gridTemplateColumns: '90px 180px 60px 200px 1fr',
                gap: 10,
                padding: '2px 0',
                color: 'var(--fg-2)',
                whiteSpace: 'nowrap',
              }}>
                <span style={{ color: 'var(--fg-4)' }}>{e.ts}</span>
                <span style={{ color: agent?.accent || 'var(--fg-3)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.agent}</span>
                <span style={{
                  color: levelColor, textTransform: 'uppercase', fontSize: 10,
                  fontWeight: 600, letterSpacing: '0.08em',
                }}>[{e.level}]</span>
                <span style={{ color: 'var(--cyan)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.event}</span>
                <span style={{ color: 'var(--fg-2)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.msg}</span>
              </div>
            );
          })}
          {!filtered.length && events.length > 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>
              filtreyle eşleşen satır yok
            </div>
          )}
          {!events.length && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>
              <div className="mono" style={{ marginBottom: 6 }}>$ tail -f hermes.log</div>
              <div className="mono">— henüz olay yok —</div>
              <div style={{ marginTop: 12, fontSize: 11 }}>
                Bir görev çalıştırdığında veya tool çağrısı yapıldığında satırlar burada görünecek.
              </div>
            </div>
          )}
          {!paused && events.length > 0 && <div style={{ color: 'var(--acid)' }}>›<span className="caret" /></div>}
        </div>
      </div>
    </div>
  );
};




export default AuditPage;
