// @ts-nocheck
// ============================================================
// AGENT.OS — Org Chart page (Paperclip-1)
// Top-down view of the agent organisation: 5 departments,
// each card lists the head agent and members. Read-only v1.
// ============================================================
import React, { useEffect, useState } from 'react';
import { BASE_URL, backendHeaders } from '@/lib/api';
import { AGENT_BY_ID } from '@/data/aos/mockData';

type OrgUnit = {
  id: string;
  parent_id: string | null;
  name: string;
  description: string;
  head_agent_id: string | null;
  icon: string;
  color: string;
  sort_order: number;
  member_agent_ids: string[];
  child_unit_ids: string[];
};

const fmtAgentLabel = (id: string): string => {
  const a = AGENT_BY_ID?.[id];
  return a?.name || id;
};

const AgentChip = ({ agentId, isHead }: { agentId: string; isHead: boolean }) => {
  const a = AGENT_BY_ID?.[agentId];
  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 8px', borderRadius: 4,
        background: isHead ? 'var(--bg-2)' : 'var(--bg-1)',
        border: `1px solid ${isHead ? (a?.accent || '#6366f1') : 'var(--border)'}`,
        fontSize: 11,
      }}
      title={agentId}
    >
      <span style={{ fontSize: 14 }}>{a?.icon || '🤖'}</span>
      <span style={{ color: 'var(--fg-1)' }}>{a?.name || agentId}</span>
      {isHead && <span style={{ fontSize: 9, color: 'var(--fg-3)', marginLeft: 2 }}>LIDER</span>}
    </div>
  );
};

const UnitCard = ({ unit }: { unit: OrgUnit }) => (
  <div
    style={{
      background: 'var(--bg-1)',
      border: `1px solid var(--border)`,
      borderTop: `3px solid ${unit.color}`,
      borderRadius: 6,
      padding: 16,
      display: 'flex', flexDirection: 'column', gap: 10,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
      <span style={{ fontSize: 22 }}>{unit.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-1)' }}>{unit.name}</div>
        <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{unit.member_agent_ids.length} ajan</div>
      </div>
    </div>
    {unit.description && (
      <div style={{ fontSize: 11, color: 'var(--fg-2)', lineHeight: 1.5 }}>{unit.description}</div>
    )}
    {unit.head_agent_id && (
      <div style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
        Reporting line → {fmtAgentLabel(unit.head_agent_id)}
      </div>
    )}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {unit.member_agent_ids.map((aid) => (
        <AgentChip key={aid} agentId={aid} isHead={aid === unit.head_agent_id} />
      ))}
    </div>
  </div>
);

const OrgPage = () => {
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/v1/org/units`, { headers: backendHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setUnits(data);
      } catch (e: any) {
        if (!cancelled) setError(String(e?.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const totalAgents = units.reduce((acc, u) => acc + u.member_agent_ids.length, 0);

  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> ORG CHART</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">Organizasyon Şeması</h1>
          <p className="page__sub">{units.length} departman · {totalAgents} ajan · Paperclip-style hiyerarşi</p>
        </div>
      </div>

      {loading && <div className="panel"><div className="panel__body">Yükleniyor…</div></div>}
      {error && (
        <div className="panel"><div className="panel__body" style={{ color: 'var(--err)' }}>Hata: {error}</div></div>
      )}

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {units.map((u) => <UnitCard key={u.id} unit={u} />)}
        </div>
      )}
    </div>
  );
};

export default OrgPage;
