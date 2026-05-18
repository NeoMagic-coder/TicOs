// @ts-nocheck
// ============================================================
// AGENT.OS — Approvals queue
// Autonomy layer policy decisions
// ============================================================
import React, { useState, useEffect, useMemo } from 'react';
import { Icon, AgentAvatar } from '@/components/AOS/widgets';
import { AGENT_BY_ID } from '@/data/aos/mockData';
import { useAdaptedApprovals, storeActions } from '@/lib/aos/adapter';
import { pushToast } from '@/components/AOS/Toast';
import { useStore } from '@/stores/useStore';
import { BASE_URL } from '@/lib/api';

const RISK_META = {
  high:   { label: 'Yüksek Risk', chip: 'rose',   color: 'var(--rose)' },
  medium: { label: 'Orta Risk',   chip: 'amber',  color: 'var(--amber)' },
  low:    { label: 'Düşük Risk',  chip: 'acid',   color: 'var(--acid)' },
};

const ApprovalCard = ({ apv, expanded, onToggle, onAction }) => {
  const agent = AGENT_BY_ID[apv.requester];
  const risk = RISK_META[apv.risk];
  return (
    <div style={{
      background: 'var(--bg-1)',
      border: `1px solid ${expanded ? risk.color : 'var(--border)'}`,
      borderLeft: `3px solid ${risk.color}`,
      borderRadius: 5,
      marginBottom: 10,
      overflow: 'hidden',
      transition: 'border-color 0.15s ease',
    }}>
      <div
        onClick={() => onToggle(apv.id)}
        style={{
          padding: '12px 16px',
          display: 'grid',
          gridTemplateColumns: '24px 1fr auto auto',
          gap: 14, alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <Icon name={expanded ? 'chevdown' : 'chevright'} size={14} color="var(--fg-3)" />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{apv.type}</span>
            <span className={`chip chip--${risk.chip}`}>{risk.label}</span>
            {apv.policy.breach && <span className="chip chip--rose">POLITIKA AŞIMI</span>}
          </div>
          <h3 style={{ margin: 0, fontSize: 14, color: 'var(--fg-1)', fontWeight: 500 }}>{apv.title}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {agent && <AgentAvatar agent={agent} size={14} />}
            <span className="mono" style={{ fontSize: 11, color: 'var(--fg-3)' }}>
              {agent?.name} · {apv.id} · {apv.createdAt}
            </span>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono tnum" style={{ fontSize: 14, color: 'var(--fg-1)', fontWeight: 500 }}>{apv.delta}</div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>conf {apv.confidence.toFixed(2)}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
          <button className="btn btn--sm btn--danger" onClick={() => onAction(apv.id, 'reject')}>
            <Icon name="x" size={10} /> Reddet
          </button>
          <button className="btn btn--sm btn--primary" onClick={() => onAction(apv.id, 'approve')}>
            <Icon name="check" size={10} /> Onayla
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{
          borderTop: '1px solid var(--border-faint)',
          background: 'var(--bg-0)',
          padding: 16,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
        }}>
          <div>
            <div className="label-eyebrow" style={{ marginBottom: 6 }}>Gerekçe</div>
            <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.55, marginBottom: 12 }}>{apv.rationale}</div>

            <div className="label-eyebrow" style={{ marginBottom: 6 }}>Politika Değerlendirmesi</div>
            <div className="term" style={{ fontSize: 11 }}>
{`autonomy_policy_check:
  auto_threshold = ${apv.policy.auto_threshold}
  this_action    = ${apv.policy.this_action}
  decision       = ${apv.policy.breach ? 'needs_approval' : 'auto_approved'}
  reason         = ${apv.policy.breach ? 'policy_breach' : 'below_threshold'}`}
            </div>
          </div>

          <div>
            <div className="label-eyebrow" style={{ marginBottom: 6 }}>Beklenen Etki</div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr', gap: 1,
              background: 'var(--border-faint)',
              border: '1px solid var(--border-faint)',
              borderRadius: 4, overflow: 'hidden',
              marginBottom: 12,
            }}>
              {Object.entries(apv.impact).map(([k,v]) => (
                <div key={k} style={{
                  padding: '8px 12px', background: 'var(--bg-1)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12,
                  gap: 8,
                }}>
                  <span style={{ color: 'var(--fg-3)', whiteSpace: 'nowrap' }} className="mono">{k}</span>
                  <span style={{ color: 'var(--fg-1)', textAlign: 'right', whiteSpace: 'nowrap' }} className="tnum">{v}</span>
                </div>
              ))}
            </div>

            <div className="label-eyebrow" style={{ marginBottom: 6 }}>Kullanılan Araçlar</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {apv.tools.map(t => <span key={t} className="chip chip--cyan">{t}</span>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const POLICY_KEY = 'aos.autonomy.policy';
const defaultPolicy = {
  max_price_change_pct: 5,
  carrier_switch_max_cost_try: 500,
  min_confidence: 0.75,
  risk_auto_threshold: 'low',
};

const ApprovalsPage = () => {
  const storeApprovals = useAdaptedApprovals();
  // Only render real store data — no cold-start fake card.
  const APPROVALS = storeApprovals;
  const usingMockFallback = false;
  const allApprovalsRaw = useStore((s: any) => s.approvals);
  const tasks = useStore((s: any) => s.tasks);
  const auditLogs = useStore((s: any) => s.auditLogs);
  const quickAsk = useStore((s: any) => s.quickAsk);

  // Real history counts pulled from the store. The previous version hardcoded
  // "142 / 5" placeholders which never reflected actual activity.
  const stats = useMemo(() => {
    const cutoff = Date.now() - 24 * 3600 * 1000;
    let autoApproved24h = 0;
    let escalated = 0;
    let approved = 0;
    let rejected = 0;
    for (const a of allApprovalsRaw || []) {
      const t = a.resolved_at ? new Date(a.resolved_at).getTime() : 0;
      if (a.status === 'approved') {
        approved += 1;
        const note = (a.reviewer_note || '').toLowerCase();
        if (t >= cutoff && (note.includes('auto') || note.includes('otonom'))) autoApproved24h += 1;
      } else if (a.status === 'rejected') {
        rejected += 1;
      }
    }
    for (const t of tasks || []) {
      if (t.status === 'escalated') escalated += 1;
    }
    // Backstop: also count audit-log auto-approval events when approvals don't
    // carry the marker (e.g. autonomy decisions that bypassed the queue).
    for (const log of auditLogs || []) {
      if (!log?.action) continue;
      if (/auto[_.]approved/.test(log.action) && new Date(log.timestamp).getTime() >= cutoff) {
        // Only count if it isn't already represented above.
        if (!log.metadata?.approval_id) autoApproved24h += 1;
      }
    }
    return { autoApproved24h, escalated, approved, rejected };
  }, [allApprovalsRaw, tasks, auditLogs]);

  const [tab, setTab] = useState('pending');
  // No card expanded by default — keeps the list scannable and avoids duplicate
  // text (the policy block repeats the action title) which trips up E2E lookups.
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actioned, setActioned] = useState<Record<string, string>>({});
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policy, setPolicy] = useState(() => {
    try {
      const raw = localStorage.getItem(POLICY_KEY);
      return raw ? { ...defaultPolicy, ...JSON.parse(raw) } : defaultPolicy;
    } catch {
      return defaultPolicy;
    }
  });
  useEffect(() => {
    // Hydrate from backend when it's reachable so changes made elsewhere are
    // reflected. Local cache stays as the offline fallback.
    fetch(`${BASE_URL}/api/v1/approvals/policy`, { signal: AbortSignal.timeout(3000) })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setPolicy((prev: any) => ({ ...prev, ...data }));
      })
      .catch(() => {});
  }, []);
  const savePolicy = async () => {
    localStorage.setItem(POLICY_KEY, JSON.stringify(policy));
    try {
      await fetch(`${BASE_URL}/api/v1/approvals/policy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(policy),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // Local-only save is acceptable when the backend is offline.
    }
    pushToast({ kind: 'success', title: 'Politika güncellendi', body: 'Otonomi eşikleri kaydedildi.' });
    setPolicyOpen(false);
  };
  const ingestExternalApproval = useStore((s: any) => s.ingestExternalApproval);

  const visible = useMemo(() => APPROVALS.filter((a: any) => !actioned[a.id]), [actioned, APPROVALS]);

  const handleAction = (id: string, kind: string) => {
    setActioned(p => ({ ...p, [id]: kind }));
    const target = APPROVALS.find((a: any) => a.id === id);
    // If this card came from the mock cold-start data, materialize it into the
    // store first so approve/reject actually persist and show up in the
    // Onaylanan / Reddedilen tabs (fixes #15).
    if (usingMockFallback && target) {
      ingestExternalApproval(target);
    }
    if (kind === 'approve') storeActions.approve(id, 'Onaylandı (UI)');
    else if (kind === 'reject') storeActions.reject(id, 'Reddedildi (UI)');
  };

  const bulkApprove = () => {
    // Use `visible` (already filtered by `actioned`) instead of raw APPROVALS so
    // we never sweep an already-handled card back into the approve loop — that
    // mismatch is what made bulk-approve hit an unrelated record (#16).
    const pending = visible;
    if (!pending.length) {
      pushToast({ kind: 'info', title: 'Boş kuyruk', body: 'Bekleyen onay yok.' });
      return;
    }
    if (!confirm(`${pending.length} bekleyen onayı toplu onaylamak istiyor musun?`)) return;
    for (const a of pending) handleAction(a.id, 'approve');
  };

  return (
    <div className="page">
      <div className="page__breadcrumb mono">HOME <span>›</span> ONAYLAR</div>
      <div className="page__header">
        <div>
          <h1 className="page__title">
            Onay Merkezi
            <span className="page__title-tag">AUTONOMY GATE</span>
            <span className="chip chip--amber">{visible.length} BEKLİYOR</span>
          </h1>
          <p className="page__sub">
            Otonom karar katmanının politika eşiklerini aşan eylemler. Hızlıca onayla ya da reddet — her karar audit log'a düşer.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost" onClick={() => setPolicyOpen(true)}>
            <Icon name="settings" size={12} /> Politikayı Düzenle
          </button>
          <button className="btn" onClick={bulkApprove}>
            <Icon name="check" size={12} /> Tümünü Toplu Onayla
          </button>
        </div>
      </div>

      {/* Policy summary strip — values come straight from the policy state +
          live store stats. Previously this block hardcoded "142 / 5" labels
          that never reflected reality. */}
      {(() => {
        const pad = (s: string, n: number) => (s + ' '.repeat(n)).slice(0, n);
        const line = (l: string, r: string) =>
          `│  ${pad(l, 38)}${pad(r, 38)}│`;
        return (
          <div className="term" style={{ marginBottom: 16, fontSize: 11 }}>
{`╭─ autonomy.policy ────────────────────────────────────────────────────────────╮
${line(`max_price_change_pct      = ${policy.max_price_change_pct}%`, `carrier_switch_max_cost = ₺${policy.carrier_switch_max_cost_try}`)}
${line(`min_confidence            = ${Number(policy.min_confidence).toFixed(2)}`, `risk_auto_threshold     = ${policy.risk_auto_threshold}`)}
${line(`auto-approved (24h)       = ${stats.autoApproved24h}`, `escalated               = ${stats.escalated}`)}
╰──────────────────────────────────────────────────────────────────────────────╯`}
          </div>
        );
      })()}

      {usingMockFallback && (
        <div style={{
          padding: '8px 12px', borderRadius: 4, marginBottom: 12,
          background: 'rgba(255,177,61,0.08)', border: '1px solid rgba(255,177,61,0.3)',
          fontSize: 11, color: 'var(--fg-2)',
        }} className="mono">
          ⚠ store boş — örnek (demo) onay kayıtları gösteriliyor. Onay/red eylemleri yalnızca UI'da kaydedilir.
        </div>
      )}

      {/* Tabs — counts now reflect real store data */}
      <div className="tabs">
        <div className={`tab ${tab==='pending' ? 'tab--active' : ''}`} onClick={() => setTab('pending')}>
          Bekleyen <span className="tab__count">{visible.length}</span>
        </div>
        <div className={`tab ${tab==='approved' ? 'tab--active' : ''}`} onClick={() => setTab('approved')}>
          Onaylanan <span className="tab__count">{stats.approved}</span>
        </div>
        <div className={`tab ${tab==='rejected' ? 'tab--active' : ''}`} onClick={() => setTab('rejected')}>
          Reddedilen <span className="tab__count">{stats.rejected}</span>
        </div>
        <div className={`tab ${tab==='auto' ? 'tab--active' : ''}`} onClick={() => setTab('auto')}>
          Otomatik (24s) <span className="tab__count">{stats.autoApproved24h}</span>
        </div>
      </div>

      {(() => {
        const historyForTab = (target: 'approved' | 'rejected') =>
          (allApprovalsRaw || [])
            .filter((a: any) => a.status === target)
            .sort((a: any, b: any) => new Date(b.resolved_at || 0).getTime() - new Date(a.resolved_at || 0).getTime());
        const autoApprovedList = (allApprovalsRaw || [])
          .filter((a: any) => {
            if (a.status !== 'approved') return false;
            const t = a.resolved_at ? new Date(a.resolved_at).getTime() : 0;
            const cutoff = Date.now() - 24 * 3600 * 1000;
            const note = (a.reviewer_note || '').toLowerCase();
            return t >= cutoff && (note.includes('auto') || note.includes('otonom'));
          })
          .sort((a: any, b: any) => new Date(b.resolved_at || 0).getTime() - new Date(a.resolved_at || 0).getTime());

        const HistoryList = ({ rows, empty }: { rows: any[]; empty: string }) => {
          if (!rows.length) {
            return (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }} className="mono">
                {empty}
              </div>
            );
          }
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rows.slice(0, 50).map((a: any) => (
                <div key={a.id} style={{
                  padding: '10px 14px',
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${a.status === 'approved' ? 'var(--acid)' : 'var(--rose)'}`,
                  borderRadius: 4,
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12, alignItems: 'center',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--fg-1)', fontWeight: 500 }}>{a.action}</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>
                      {a.agent_id} · {a.id}
                      {a.reviewer_note ? ` · "${a.reviewer_note.slice(0, 60)}"` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: 10, color: a.status === 'approved' ? 'var(--acid)' : 'var(--rose)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {a.status === 'approved' ? 'onaylandı' : 'reddedildi'}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 2 }}>
                      {a.resolved_at ? new Date(a.resolved_at).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        };

        return (
          <div>
            {tab === 'pending' && visible.map((apv: any) => (
              <ApprovalCard
                key={apv.id}
                apv={apv}
                expanded={expanded === apv.id}
                onToggle={(id) => setExpanded((e) => (e === id ? null : id))}
                onAction={handleAction}
              />
            ))}
            {tab === 'pending' && !visible.length && (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)' }}>
                <div className="mono">╭─ tüm onaylar temiz ─╮</div>
                <div style={{ marginTop: 12, fontSize: 13 }}>Otonomi katmanı her şeyi kendi başına halletti.</div>
              </div>
            )}
            {tab === 'approved' && <HistoryList rows={historyForTab('approved')} empty="henüz onaylanmış aksiyon yok" />}
            {tab === 'rejected' && <HistoryList rows={historyForTab('rejected')} empty="henüz reddedilmiş aksiyon yok" />}
            {tab === 'auto' && (
              <HistoryList
                rows={autoApprovedList}
                empty="son 24 saatte otomatik onay yok"
              />
            )}
          </div>
        );
      })()}

      {policyOpen && (
        <div
          onClick={() => setPolicyOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'grid', placeItems: 'center', zIndex: 100 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-1)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 24,
              width: 460,
              maxWidth: '92vw',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Icon name="settings" size={16} />
              <h3 style={{ margin: 0, fontSize: 15 }}>Otonomi Politikası</h3>
            </div>
            <div style={{ display: 'grid', gap: 12, fontSize: 12 }}>
              <label>
                <div className="label-eyebrow" style={{ marginBottom: 4 }}>Max fiyat değişimi (%)</div>
                <input
                  type="number"
                  value={policy.max_price_change_pct}
                  onChange={(e) => setPolicy({ ...policy, max_price_change_pct: Number(e.target.value) })}
                  className="input"
                  style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--fg-1)' }}
                />
              </label>
              <label>
                <div className="label-eyebrow" style={{ marginBottom: 4 }}>Kargo değişimi max maliyeti (₺)</div>
                <input
                  type="number"
                  value={policy.carrier_switch_max_cost_try}
                  onChange={(e) => setPolicy({ ...policy, carrier_switch_max_cost_try: Number(e.target.value) })}
                  style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--fg-1)' }}
                />
              </label>
              <label>
                <div className="label-eyebrow" style={{ marginBottom: 4 }}>Min güven skoru</div>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={policy.min_confidence}
                  onChange={(e) => setPolicy({ ...policy, min_confidence: Number(e.target.value) })}
                  style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--fg-1)' }}
                />
              </label>
              <label>
                <div className="label-eyebrow" style={{ marginBottom: 4 }}>Otomatik onay risk eşiği</div>
                <select
                  value={policy.risk_auto_threshold}
                  onChange={(e) => setPolicy({ ...policy, risk_auto_threshold: e.target.value })}
                  style={{ width: '100%', padding: '6px 8px', background: 'var(--bg-0)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--fg-1)' }}
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
              <button className="btn btn--ghost btn--sm" onClick={() => setPolicyOpen(false)}>Vazgeç</button>
              <button className="btn btn--primary btn--sm" onClick={savePolicy}>Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};




export default ApprovalsPage;
