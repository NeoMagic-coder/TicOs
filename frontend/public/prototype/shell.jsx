/* global React, AOSWidgets, AGENT_OS_DATA */
// ============================================================
// AGENT.OS — Shell: Menubar, Sidebar, ProcessStrip, CmdPalette
// ============================================================
const { useState, useEffect, useRef, useMemo, useCallback } = React;
const { Icon, StatusDot, AgentAvatar } = window.AOSWidgets;

// ============================================================
// Top Menubar — macOS-style system status
// ============================================================
const Menubar = ({ sysClock, runningCount, busyCount, budgetBurn, confidence, onCmd }) => {
  return (
    <div className="menubar">
      <div className="menubar__brand">
        <span className="menubar__brand-mark" />
        <span>AGENT.OS</span>
        <span style={{ color: 'var(--fg-3)', fontWeight: 400, marginLeft: 4 }}>v0.42</span>
      </div>
      <div className="menubar__sep" />
      <div className="menubar__items">
        <div className="menubar__item">
          <span className="menubar__item-label">Aktif Ürün</span>
          <span className="menubar__item-value">OP Krem 50ml</span>
        </div>
        <div className="menubar__item">
          <span className="menubar__item-label">Pazar</span>
          <span className="menubar__item-value">TR</span>
        </div>
        <div className="menubar__item">
          <span className="menubar__item-label">Aşama</span>
          <span className="menubar__item-value">Ölçeklendirme</span>
        </div>
      </div>
      <div className="menubar__spacer" />
      <div className="menubar__right">
        <div className="menubar__item" onClick={onCmd}>
          <Icon name="search" size={12} color="var(--fg-3)" />
          <span className="menubar__item-label">Komut</span>
          <span className="btn__kbd" style={{ marginLeft: 2 }}>⌘K</span>
        </div>
        <div className="menubar__item">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--acid)', boxShadow: '0 0 6px var(--acid)' }} />
          <span className="menubar__item-value tnum">{runningCount} çalışıyor</span>
        </div>
        <div className="menubar__item">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)' }} />
          <span className="menubar__item-value tnum">{busyCount} meşgul</span>
        </div>
        <div className="menubar__item">
          <span className="menubar__item-label">Bütçe</span>
          <span className="menubar__item-value">{budgetBurn}</span>
        </div>
        <div className="menubar__item">
          <span className="menubar__item-label">Conf</span>
          <span className="menubar__item-value">{confidence}</span>
        </div>
        <div className="menubar__item">
          <span className="menubar__item-value tnum">{sysClock}</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Sidebar
// ============================================================
const NAV_SECTIONS = [
  {
    label: 'Sistem',
    items: [
      { id: 'dashboard',  label: 'Dashboard',         icon: 'dashboard' },
      { id: 'supervisor', label: 'Supervisor',        icon: 'chat', badge: 'live' },
      { id: 'graph',      label: 'Görev Grafiği',     icon: 'graph', badge: '3' },
    ],
  },
  {
    label: 'Ajan Altyapısı',
    items: [
      { id: 'office',     label: 'Agent Office',      icon: 'agents', badge: '22' },
      { id: 'approvals',  label: 'Onaylar',           icon: 'approvals', badge: 'alert:5' },
      { id: 'tools',      label: 'Araçlar',           icon: 'tools' },
      { id: 'audit',      label: 'Audit Log',         icon: 'audit' },
    ],
  },
  {
    label: 'Ürün OS',
    items: [
      { id: 'brand',      label: 'Marka',             icon: 'brand' },
      { id: 'pricing',    label: 'Fiyat & Finans',    icon: 'money' },
      { id: 'growth',     label: 'Büyüme',            icon: 'growth' },
      { id: 'onboarding', label: 'Onboarding',        icon: 'onboarding' },
    ],
  },
];

const Sidebar = ({ active, onNavigate }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar__product">
        <div className="sidebar__product-thumb">OP</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="sidebar__product-name">
            OP Aydınlatıcı Krem
            <Icon name="chevdown" size={12} color="var(--fg-3)" />
          </div>
          <div className="sidebar__product-meta">SKU · OP-CRM-50ML</div>
        </div>
      </div>
      <nav className="sidebar__nav">
        {NAV_SECTIONS.map(sec => (
          <div key={sec.label}>
            <div className="sidebar__section">{sec.label}</div>
            {sec.items.map(it => {
              const isActive = active === it.id;
              const isAlert = it.badge && String(it.badge).startsWith('alert:');
              const badgeVal = isAlert ? it.badge.split(':')[1] : it.badge;
              const isLive = it.badge === 'live';
              return (
                <div
                  key={it.id}
                  className={`nav-item ${isActive ? 'nav-item--active' : ''}`}
                  onClick={() => onNavigate(it.id)}
                >
                  <span className="nav-item__icon"><Icon name={it.icon} size={15} /></span>
                  <span>{it.label}</span>
                  {it.badge && (
                    isLive ? (
                      <span className="nav-item__badge nav-item__badge--live mono">
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--acid)', display: 'inline-block', marginRight: 4 }} />
                        LIVE
                      </span>
                    ) : (
                      <span className={`nav-item__badge ${isAlert ? 'nav-item__badge--alert' : ''}`}>
                        {badgeVal}
                      </span>
                    )
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar__footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-2)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--acid)' }} />
          Hermes · OpenClaw
        </div>
        <div>22 ajan · 76 araç</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <span><span style={{ color: 'var(--acid)' }}>●</span> 12 live</span>
          <span><span style={{ color: 'var(--amber)' }}>●</span> 64 mock</span>
        </div>
      </div>
    </aside>
  );
};

// ============================================================
// Bottom Process Strip — Activity Monitor style
// ============================================================
const ProcessStrip = ({ agents }) => {
  const active = agents.filter(a => a.status === 'running' || a.status === 'busy').slice(0, 8);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1200);
    return () => clearInterval(id);
  }, []);
  // Drift load up/down a bit so the bars feel alive
  const driftedLoad = (a) => {
    const seed = (a.pid.charCodeAt(2) + tick) % 13;
    return Math.max(8, Math.min(95, a.load + (seed - 6)));
  };
  const totalCalls = 18 + (tick % 6);
  return (
    <div className="procstrip">
      <div className="procstrip__label">PROCESSES</div>
      <div className="procstrip__items">
        {active.map(a => {
          const load = driftedLoad(a);
          return (
            <div key={a.pid} className="procstrip__item" title={`${a.name} · ${a.lastTool}`}>
              <StatusDot status={a.status} size={6} />
              <span style={{ color: a.accent, fontWeight: 600 }}>{a.pid}</span>
              <span style={{ color: 'var(--fg-2)' }}>{a.name.toLowerCase()}</span>
              <div className="procstrip__bar">
                <div className="procstrip__bar-fill" style={{
                  width: load + '%',
                  background: a.accent,
                  transition: 'width 1.2s linear'
                }} />
              </div>
              <span style={{ color: 'var(--fg-3)' }} className="tnum">{load}%</span>
            </div>
          );
        })}
      </div>
      <div className="procstrip__sys">
        <div className="procstrip__sys-item">
          <Icon name="cpu" size={12} color="var(--fg-3)" />
          <span>orchestrator: <span style={{ color: 'var(--fg-1)' }} className="tnum">3</span> dag · <span style={{ color: 'var(--fg-1)' }} className="tnum">{totalCalls}</span> calls/min</span>
        </div>
        <div className="procstrip__sys-item">
          <Icon name="zap" size={12} color="var(--amber)" />
          <span style={{ color: 'var(--fg-1)' }} className="tnum">$0.42/h</span>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Command Palette
// ============================================================
const CMD_ITEMS = [
  { group: 'Hızlı Komut', items: [
    { id: 'plan',        title: 'Bugünün planını çıkar',                  hint: 'Supervisor günü planlar' },
    { id: 'pricing',     title: 'Fiyat optimizasyonu çalıştır',           hint: 'Tüm SKU\'lar için rakip taraması' },
    { id: 'reviews',     title: 'Yeni yorumları topla ve yanıtla',        hint: 'Trendyol + Shopify + Hepsiburada' },
    { id: 'reorder',     title: 'Reorder öneri raporu',                   hint: 'Operations + Logistics' },
    { id: 'campaign',    title: 'Yeni Meta kampanyası taslağı',           hint: 'Marketing → Content & SEO' },
  ]},
  { group: 'Navigasyon', items: [
    { id: 'go-dash',     title: 'Dashboard\'a git',                       hint: '⌘1' },
    { id: 'go-graph',    title: 'Görev Grafiği\'ne git',                  hint: '⌘2' },
    { id: 'go-office',   title: 'Agent Office\'e git',                    hint: '⌘3' },
    { id: 'go-approvals',title: 'Onaylar\'a git',                         hint: '⌘4' },
    { id: 'go-tools',    title: 'Araçlar\'a git',                         hint: '⌘5' },
  ]},
];

const CmdPalette = ({ open, onClose, onNavigate }) => {
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  useEffect(() => {
    if (open) {
      setQ(''); setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!q) return CMD_ITEMS;
    const ql = q.toLowerCase();
    return CMD_ITEMS.map(g => ({
      ...g,
      items: g.items.filter(it => it.title.toLowerCase().includes(ql) || it.hint.toLowerCase().includes(ql))
    })).filter(g => g.items.length);
  }, [q]);

  const flatItems = filtered.flatMap(g => g.items);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(flatItems.length - 1, i + 1)); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx(i => Math.max(0, i - 1)); }
      else if (e.key === 'Enter')     { e.preventDefault(); const it = flatItems[idx]; if (it) handleSelect(it); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, flatItems, idx]);

  const handleSelect = (it) => {
    if (it.id.startsWith('go-')) {
      const target = it.id.replace('go-', '').replace('dash', 'dashboard');
      onNavigate(target);
    } else {
      onNavigate('supervisor', { prompt: it.title });
    }
    onClose();
  };

  if (!open) return null;
  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="cmd" onClick={e => e.stopPropagation()}>
        <div className="cmd__head">
          <span className="cmd__prompt">›</span>
          <input
            ref={inputRef}
            className="cmd__input"
            placeholder="Komut yaz veya ajana görev ver…"
            value={q}
            onChange={e => { setQ(e.target.value); setIdx(0); }}
          />
          <span className="btn__kbd">ESC</span>
        </div>
        <div className="cmd__list">
          {filtered.map(g => (
            <div key={g.group}>
              <div className="cmd__group-label">{g.group}</div>
              {g.items.map(it => {
                const flatIdx = flatItems.indexOf(it);
                return (
                  <div
                    key={it.id}
                    className={`cmd__item ${flatIdx === idx ? 'cmd__item--active' : ''}`}
                    onMouseEnter={() => setIdx(flatIdx)}
                    onClick={() => handleSelect(it)}
                  >
                    <span className="cmd__item-icon">
                      <Icon name={it.id.startsWith('go-') ? 'chevrightSmall' : 'sparkles'} size={12} />
                    </span>
                    <div className="cmd__item-text">
                      <strong>{it.title}</strong>
                      <small>{it.hint}</small>
                    </div>
                    <span className="cmd__item-kbd">↵</span>
                  </div>
                );
              })}
            </div>
          ))}
          {!flatItems.length && (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>
              Eşleşen komut yok. Doğrudan Supervisor\'a yazabilirsin.
            </div>
          )}
        </div>
        <div className="cmd__foot">
          <span>↑↓ gezin</span>
          <span>↵ çalıştır</span>
          <span>ESC kapat</span>
          <span style={{ marginLeft: 'auto', color: 'var(--acid)' }}>● Hermes hazır</span>
        </div>
      </div>
    </div>
  );
};

window.AOSShell = { Menubar, Sidebar, ProcessStrip, CmdPalette };
