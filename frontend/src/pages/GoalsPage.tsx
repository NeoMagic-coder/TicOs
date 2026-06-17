// @ts-nocheck
// ============================================================
// AGENT.OS — Goals page (Paperclip-2)
// Goal ancestry tree. Tasks chain up to goals; every node shows
// task count + owner. Create + delete supported; nested via parent_goal_id.
// ============================================================
import React, { useEffect, useState, useCallback } from 'react';
import { BASE_URL, backendHeaders } from '@/lib/api';
import { AGENT_BY_ID } from '@/data/aos/mockData';
import { useStore } from '@/stores/useStore';

type Goal = {
  id: string;
  parent_goal_id: string | null;
  title: string;
  description: string;
  owner_agent_id: string | null;
  owner_org_unit_id: string | null;
  target_metric: string;
  target_value: number | null;
  current_value: number | null;
  status: 'active' | 'paused' | 'done' | 'abandoned';
  deadline: string | null;
};

type GoalNode = { goal: Goal; children: GoalNode[]; task_count: number };

const STATUS_COLOR: Record<string, string> = {
  active: '#10b981', paused: '#f59e0b', done: '#6366f1', abandoned: '#94a3b8',
};

const ownerLabel = (id: string | null): string => {
  if (!id) return '—';
  return AGENT_BY_ID?.[id]?.name || id;
};

const GoalRow = ({ node, depth, onDelete, onAdvance }: { node: GoalNode; depth: number; onDelete: (id: string) => void; onAdvance: (id: string) => void }) => {
  const g = node.goal;
  return (
    <>
      <div
        style={{
          background: 'var(--bg-1)',
          border: `1px solid var(--border)`,
          borderLeft: `3px solid ${STATUS_COLOR[g.status]}`,
          borderRadius: 5,
          padding: 12,
          marginLeft: depth * 24,
          marginBottom: 6,
          display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-1)' }}>{g.title}</span>
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'var(--bg-2)', color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {g.status}
            </span>
          </div>
          {g.description && (
            <div style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 4 }}>{g.description}</div>
          )}
          <div style={{ display: 'flex', gap: 16, fontSize: 10, color: 'var(--fg-3)', marginTop: 6 }}>
            <span>Sahip: {ownerLabel(g.owner_agent_id)}</span>
            {g.target_metric && (
              <span>Metrik: {g.target_metric} {g.target_value != null ? `→ ${g.target_value}` : ''}</span>
            )}
            <span>Bağlı görev: {node.task_count}</span>
          </div>
        </div>
        {g.status === 'active' && (
          <button
            type="button"
            onClick={async () => {
              await onAdvance(g.id);
            }}
            style={{ fontSize: 10, padding: '4px 10px', background: 'var(--accent)', border: 'none', color: '#000', borderRadius: 3, cursor: 'pointer' }}
          >Otonom ilerle</button>
        )}
        <button
          onClick={() => onDelete(g.id)}
          style={{ fontSize: 10, padding: '4px 10px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--fg-3)', borderRadius: 3, cursor: 'pointer' }}
        >Sil</button>
      </div>
      {node.children.map((child) => (
        <GoalRow key={child.goal.id} node={child} depth={depth + 1} onDelete={onDelete} onAdvance={onAdvance} />
      ))}
    </>
  );
};

const GoalsPage = () => {
  const [tree, setTree] = useState<GoalNode[]>([]);
  const [allGoals, setAllGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', parent_goal_id: '', target_metric: '', target_value: '' });
  const autonomyStatus = useStore((s: any) => s.autonomyStatus);
  const runGoalLoopTick = useStore((s: any) => s.runGoalLoopTick);
  const loadAutonomyStatus = useStore((s: any) => s.loadAutonomyStatus);
  const goalLoop = autonomyStatus?.goal_loop;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [treeRes, listRes] = await Promise.all([
        fetch(`${BASE_URL}/api/v1/goals/tree/full`, { headers: backendHeaders() }),
        fetch(`${BASE_URL}/api/v1/goals`, { headers: backendHeaders() }),
      ]);
      if (!treeRes.ok) throw new Error(`tree HTTP ${treeRes.status}`);
      if (!listRes.ok) throw new Error(`list HTTP ${listRes.status}`);
      setTree(await treeRes.json());
      setAllGoals(await listRes.json());
      setError(null);
    } catch (e: any) {
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { void loadAutonomyStatus(); }, [loadAutonomyStatus]);

  const handleAdvance = async (goalId: string) => {
    await runGoalLoopTick(goalId);
    await refresh();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    const body: any = {
      title: form.title.trim(),
      description: form.description.trim(),
      parent_goal_id: form.parent_goal_id || null,
      target_metric: form.target_metric.trim(),
    };
    if (form.target_value) body.target_value = parseFloat(form.target_value);
    const res = await fetch(`${BASE_URL}/api/v1/goals`, {
      method: 'POST',
      headers: backendHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setForm({ title: '', description: '', parent_goal_id: '', target_metric: '', target_value: '' });
      setShowForm(false);
      await refresh();
    } else {
      alert(`Hata: HTTP ${res.status}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu hedef silinsin mi?')) return;
    const res = await fetch(`${BASE_URL}/api/v1/goals/${id}`, {
      method: 'DELETE', headers: backendHeaders(),
    });
    if (res.ok) await refresh();
  };

  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> GOALS</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">Hedefler (Goal Ancestry)</h1>
          <p className="page__sub">{allGoals.length} hedef · Görevler bir hedefe bağlanır; hedefler ağaç yapısında.</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          style={{ padding: '8px 14px', background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
        >{showForm ? 'İptal' : '+ Yeni Hedef'}</button>
        <button
          type="button"
          onClick={() => void runGoalLoopTick()}
          style={{ padding: '8px 14px', background: 'transparent', color: 'var(--fg-2)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
        >Hedef döngüsü</button>
      </div>

      {goalLoop && (
        <div className="panel" style={{ marginBottom: 12 }}>
          <div className="panel__body" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 11, color: 'var(--fg-2)' }}>
            <span>Otonom hedef döngüsü: {goalLoop.enabled ? 'aktif' : 'kapalı'}</span>
            <span>{goalLoop.active_goals ?? 0} aktif hedef</span>
            <span>{goalLoop.stale_count ?? 0} bekleyen (stale)</span>
            {goalLoop.last_tick_at && (
              <span>Son tick: {new Date(goalLoop.last_tick_at).toLocaleString('tr-TR')}</span>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="panel" style={{ marginBottom: 12 }}>
          <div className="panel__body" style={{ display: 'grid', gap: 8 }}>
            <input
              placeholder="Başlık (örn. Aylık ciroyu 2× artır)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={{ padding: 8, background: 'var(--bg-0)', border: '1px solid var(--border)', color: 'var(--fg-1)', borderRadius: 3 }}
            />
            <textarea
              placeholder="Açıklama"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              style={{ padding: 8, background: 'var(--bg-0)', border: '1px solid var(--border)', color: 'var(--fg-1)', borderRadius: 3 }}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <select
                value={form.parent_goal_id}
                onChange={(e) => setForm({ ...form, parent_goal_id: e.target.value })}
                style={{ padding: 8, background: 'var(--bg-0)', border: '1px solid var(--border)', color: 'var(--fg-1)', borderRadius: 3 }}
              >
                <option value="">— Üst hedef yok —</option>
                {allGoals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
              <input
                placeholder="Metrik (revenue_try)"
                value={form.target_metric}
                onChange={(e) => setForm({ ...form, target_metric: e.target.value })}
                style={{ padding: 8, background: 'var(--bg-0)', border: '1px solid var(--border)', color: 'var(--fg-1)', borderRadius: 3 }}
              />
              <input
                placeholder="Hedef değer (sayı)"
                type="number"
                value={form.target_value}
                onChange={(e) => setForm({ ...form, target_value: e.target.value })}
                style={{ padding: 8, background: 'var(--bg-0)', border: '1px solid var(--border)', color: 'var(--fg-1)', borderRadius: 3 }}
              />
            </div>
            <button type="submit" style={{ padding: 8, background: 'var(--accent)', color: '#000', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12 }}>
              Hedef Oluştur
            </button>
          </div>
        </form>
      )}

      {loading && <div className="panel"><div className="panel__body">Yükleniyor…</div></div>}
      {error && <div className="panel"><div className="panel__body" style={{ color: 'var(--err)' }}>Hata: {error}</div></div>}

      {!loading && !error && tree.length === 0 && (
        <div className="panel"><div className="panel__body" style={{ color: 'var(--fg-3)' }}>
          Henüz hedef yok. "+ Yeni Hedef" ile başla — örnek: <em>"Bu çeyrek 100 sipariş/gün"</em>.
        </div></div>
      )}

      {!loading && !error && tree.map((n) => (
        <GoalRow key={n.goal.id} node={n} depth={0} onDelete={handleDelete} onAdvance={handleAdvance} />
      ))}
    </div>
  );
};

export default GoalsPage;
