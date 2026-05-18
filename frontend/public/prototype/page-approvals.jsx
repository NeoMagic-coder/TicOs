/* global React, AOSWidgets, AGENT_OS_DATA */
// ============================================================
// AGENT.OS — Approvals queue
// Autonomy layer policy decisions
// ============================================================
const { useState, useEffect, useMemo } = React;
const { Icon, AgentAvatar } = window.AOSWidgets;
const { APPROVALS, AGENT_BY_ID } = window.AGENT_OS_DATA;

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
          <div style={{ fontSize: 14, color: 'var(--fg-1)', fontWeight: 500 }}>{apv.title}</div>
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

const ApprovalsPage = () => {
  const [tab, setTab] = useState('pending');
  const [expanded, setExpanded] = useState(APPROVALS[0]?.id);
  const [actioned, setActioned] = useState({});

  const visible = useMemo(() => APPROVALS.filter(a => !actioned[a.id]), [actioned]);

  const handleAction = (id, kind) => {
    setActioned(p => ({ ...p, [id]: kind }));
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
          <button className="btn btn--ghost">
            <Icon name="settings" size={12} /> Politikayı Düzenle
          </button>
          <button className="btn">
            <Icon name="check" size={12} /> Tümünü Toplu Onayla
          </button>
        </div>
      </div>

      {/* Policy summary strip */}
      <div className="term" style={{ marginBottom: 16, fontSize: 11 }}>
{`╭─ autonomy.policy ────────────────────────────────────────────────────────────╮
│  max_price_change_pct      = 5%        carrier_switch_max_cost = ₺500        │
│  min_confidence            = 0.75      risk_auto_threshold     = low         │
│  auto-approved (24h)       = 142       escalated               = 5           │
╰──────────────────────────────────────────────────────────────────────────────╯`}
      </div>

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab ${tab==='pending' ? 'tab--active' : ''}`} onClick={() => setTab('pending')}>
          Bekleyen <span className="tab__count">{visible.length}</span>
        </div>
        <div className={`tab ${tab==='approved' ? 'tab--active' : ''}`} onClick={() => setTab('approved')}>
          Onaylanan <span className="tab__count">{Object.values(actioned).filter(v=>v==='approve').length}</span>
        </div>
        <div className={`tab ${tab==='rejected' ? 'tab--active' : ''}`} onClick={() => setTab('rejected')}>
          Reddedilen <span className="tab__count">{Object.values(actioned).filter(v=>v==='reject').length}</span>
        </div>
        <div className={`tab ${tab==='auto' ? 'tab--active' : ''}`} onClick={() => setTab('auto')}>
          Otomatik <span className="tab__count">142</span>
        </div>
      </div>

      <div>
        {tab === 'pending' && visible.map(apv => (
          <ApprovalCard
            key={apv.id}
            apv={apv}
            expanded={expanded === apv.id}
            onToggle={(id) => setExpanded(e => e === id ? null : id)}
            onAction={handleAction}
          />
        ))}
        {tab === 'pending' && !visible.length && (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)' }}>
            <div className="mono">╭─ tüm onaylar temiz ─╮</div>
            <div style={{ marginTop: 12, fontSize: 13 }}>Otonomi katmanı her şeyi kendi başına halletti.</div>
          </div>
        )}
        {tab !== 'pending' && (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }} className="mono">
            bu sekmeyi açtığında geçmiş kayıtlar gösterilir
          </div>
        )}
      </div>
    </div>
  );
};

window.AOSPages = window.AOSPages || {};
window.AOSPages.Approvals = ApprovalsPage;
