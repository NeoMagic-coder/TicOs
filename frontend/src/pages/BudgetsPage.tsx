// @ts-nocheck
// ============================================================
// AGENT.OS — Per-agent Monthly Budgets (Paperclip-4)
// One row per agent. Edit limit_usd inline → PUT /agents/{id}/budget.
// Orchestrator skips runs with status="escalated" when remaining<=0.
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import { BASE_URL, backendHeaders } from '@/lib/api';
import { useStore } from '@/stores/useStore';
import { AGENT_BY_ID } from '@/data/aos/mockData';

type Budget = {
  agent_id: string;
  month: string;
  limit_usd: number;
  spent_usd: number;
  warn_threshold_pct: number;
  remaining_usd: number;
  pct_used: number;
  exhausted: boolean;
  last_spend_at: string | null;
};

const fmt$ = (v: number) => `$${v.toFixed(4)}`;

const BudgetRow = ({ agentId, budget, onSave }: { agentId: string; budget: Budget | null; onSave: (limit: number) => Promise<void> }) => {
  const a = AGENT_BY_ID?.[agentId];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(budget?.limit_usd?.toString() ?? '0');
  const pct = budget?.pct_used ?? 0;
  const warnAt = budget?.warn_threshold_pct ?? 80;
  const barColor = budget?.exhausted ? '#ef4444' : pct >= warnAt ? '#f59e0b' : '#10b981';

  const handleSave = async () => {
    const n = parseFloat(draft);
    if (Number.isNaN(n) || n < 0) return;
    await onSave(n);
    setEditing(false);
  };

  return (
    <div
      style={{
        background: 'var(--bg-1)',
        border: `1px solid ${budget?.exhausted ? '#ef4444' : 'var(--border)'}`,
        borderRadius: 5,
        padding: 12,
        marginBottom: 6,
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr 1.5fr auto',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>{a?.icon || '🤖'}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fg-1)' }}>{a?.name || agentId}</div>
          <div style={{ fontSize: 9, color: 'var(--fg-3)' }}>{agentId}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--fg-2)' }}>
        Harcanan: <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{fmt$(budget?.spent_usd ?? 0)}</span>
        {budget && budget.limit_usd > 0 && <>
          {' '}/ {fmt$(budget.limit_usd)}
        </>}
        <div style={{ fontSize: 9, color: 'var(--fg-3)', marginTop: 2 }}>
          {budget?.last_spend_at ? `Son: ${new Date(budget.last_spend_at).toLocaleString('tr-TR')}` : 'Henüz harcama yok'}
        </div>
      </div>
      <div>
        <div style={{ height: 8, background: 'var(--bg-2)', borderRadius: 4, overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${Math.min(100, pct)}%`,
              background: barColor,
              transition: 'width 0.25s',
            }}
          />
        </div>
        <div style={{ fontSize: 9, color: 'var(--fg-3)', marginTop: 4 }}>
          {budget && budget.limit_usd > 0 ? `${pct.toFixed(1)}% kullanıldı` : 'Limit yok (sınırsız)'}
          {budget?.exhausted && <span style={{ color: '#ef4444', marginLeft: 8 }}>· TÜKENDİ</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {editing ? (
          <>
            <input
              type="number"
              step="0.01"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="USD limit"
              style={{ width: 80, padding: '4px 6px', background: 'var(--bg-0)', border: '1px solid var(--border)', color: 'var(--fg-1)', borderRadius: 3, fontSize: 11 }}
            />
            <button onClick={handleSave} style={{ padding: '4px 10px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 3, fontSize: 11, cursor: 'pointer' }}>Kaydet</button>
            <button onClick={() => setEditing(false)} style={{ padding: '4px 10px', background: 'transparent', color: 'var(--fg-3)', border: '1px solid var(--border)', borderRadius: 3, fontSize: 11, cursor: 'pointer' }}>İptal</button>
          </>
        ) : (
          <button onClick={() => { setDraft(String(budget?.limit_usd ?? 0)); setEditing(true); }} style={{ padding: '4px 12px', background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--border)', borderRadius: 3, fontSize: 11, cursor: 'pointer' }}>Limit Ayarla</button>
        )}
      </div>
    </div>
  );
};

const BudgetsPage = () => {
  const agents = useStore((s: any) => s.agents);
  const [budgets, setBudgets] = useState<Record<string, Budget>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/agents/budgets`, { headers: backendHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list: Budget[] = await res.json();
      const map: Record<string, Budget> = {};
      for (const b of list) map[b.agent_id] = b;
      setBudgets(map);
      setError(null);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const saveLimit = async (agentId: string, limit: number) => {
    const res = await fetch(`${BASE_URL}/api/v1/agents/${agentId}/budget`, {
      method: 'PUT',
      headers: backendHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ limit_usd: limit, warn_threshold_pct: 80 }),
    });
    if (res.ok) await refresh();
    else alert(`Hata: HTTP ${res.status}`);
  };

  const grandSpent = Object.values(budgets).reduce((acc, b) => acc + (b.spent_usd || 0), 0);
  const grandLimit = Object.values(budgets).reduce((acc, b) => acc + (b.limit_usd || 0), 0);

  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> BUDGETS</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">Aylık Bütçe Zarfları</h1>
          <p className="page__sub">
            Aylık: {fmt$(grandSpent)} harcandı{grandLimit > 0 ? ` / ${fmt$(grandLimit)} toplam limit` : ''} ·
            Limit 0 = sınırsız · Tükenmiş ajan run isteklerinde "escalated" döner.
          </p>
        </div>
      </div>

      {loading && <div className="panel"><div className="panel__body">Yükleniyor…</div></div>}
      {error && <div className="panel"><div className="panel__body" style={{ color: 'var(--err)' }}>Hata: {error}</div></div>}

      {!loading && !error && agents.map((a: any) => (
        <BudgetRow
          key={a.id || a.agent_id}
          agentId={a.id || a.agent_id}
          budget={budgets[a.id || a.agent_id] || null}
          onSave={(limit) => saveLimit(a.id || a.agent_id, limit)}
        />
      ))}
    </div>
  );
};

export default BudgetsPage;
