// @ts-nocheck
// ============================================================
// AGENT.OS — Shell: Menubar, Sidebar, ProcessStrip, CmdPalette
// ============================================================
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icon, StatusDot, AgentAvatar } from '@/components/AOS/widgets';
import { useStore } from '@/stores/useStore';
import { HUB_SECTIONS } from '@/lib/navigation/hubs';
import { EASY_MODE } from '@/lib/easyMode';

const Menubar = ({ sysClock, runningCount, busyCount }) => {
  const product = useStore((s: any) => s.onboardedProduct);
  const isThinking = useStore((s: any) => s.isThinking);
  const dashboard = useStore((s: any) => s.dashboard);
  const backendStatus = useStore((s: any) => s.backendStatus);
  const fallbackActive = useStore((s: any) => s.fallbackActive);
  const products = useStore((s: any) => s.products);
  const switchToProduct = useStore((s: any) => s.switchToProduct);
  const setCurrentPage = useStore((s: any) => s.setCurrentPage);
  const startNewProductOnboarding = useStore((s: any) => s.startNewProductOnboarding);
  const productName = product?.product_name || 'Ürün yok';
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!switcherOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) setSwitcherOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [switcherOpen]);
  const backend = (() => {
    if (backendStatus === 'online') return { label: 'Bağlı', dot: 'var(--acid)', title: 'Backend ulaşılabilir' };
    if (backendStatus === 'offline') return {
      label: fallbackActive ? 'Fallback' : 'Çevrimdışı',
      dot: fallbackActive ? 'var(--amber)' : 'var(--rose)',
      title: fallbackActive ? 'Backend çevrimdışı — LLM proxy fallback aktif.' : 'Backend çevrimdışı.',
    };
    return { label: '…', dot: 'var(--fg-4)', title: 'Backend durumu kontrol ediliyor' };
  })();
  return (
    <div className={`menubar ${EASY_MODE ? 'menubar--easy' : ''}`}>
      <div className="menubar__brand">
        <img className="menubar__brand-mark" src="/ticosclaw-icon.png" alt="" aria-hidden="true" />
        <span>TicOSClaw</span>
      </div>
      <div className="menubar__items">
        {EASY_MODE ? (
          <div className="menubar__item menubar__item--easy-name">
            <span className="menubar__item-value">{productName}</span>
          </div>
        ) : (
        <div className="menubar__item" ref={switcherRef} style={{ position: 'relative' }}>
          <button
            type="button"
            aria-label={`Aktif ürünü değiştir: ${productName}`}
            aria-haspopup="listbox"
            aria-expanded={switcherOpen}
            onClick={() => setSwitcherOpen((o) => !o)}
            className="menubar__product-trigger"
          >
            <span className="menubar__item-value">{productName}</span>
            <Icon name="chevron-down" size={10} color="var(--fg-3)" />
          </button>
          {switcherOpen && (
            <div
              role="listbox"
              style={{
                position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 100,
                minWidth: 240, background: 'var(--bg-1, #0b0b0b)', border: '1px solid var(--border)',
                borderRadius: 6, boxShadow: '0 12px 32px rgba(0,0,0,0.45)', padding: 4,
              }}
            >
              {(products || []).map((p: any) => (
                <button
                  key={p.product_name}
                  role="option"
                  type="button"
                  aria-selected={p.product_name === productName}
                  onMouseDown={(e) => {
                    // mousedown beats focus/blur on the trigger — without this,
                    // the first click could be swallowed by the open/close race.
                    e.preventDefault();
                    switchToProduct(p.product_name);
                    setSwitcherOpen(false);
                  }}
                  onClick={(e) => {
                    // Keyboard Enter (detail===0) fallback for a11y.
                    if (e.detail !== 0) return;
                    switchToProduct(p.product_name);
                    setSwitcherOpen(false);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', background: 'transparent', border: 'none', color: 'var(--fg-1)',
                    padding: '8px 10px', borderRadius: 4, fontSize: 12, cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span>{p.product_name}</span>
                  {p.product_name === productName && <span className="mono" style={{ fontSize: 9, color: 'var(--acid)' }}>● aktif</span>}
                </button>
              ))}
              <div style={{ height: 1, background: 'var(--border-faint)', margin: '4px 0' }} />
              <button
                role="option"
                type="button"
                onClick={() => {
                  startNewProductOnboarding?.();
                  setSwitcherOpen(false);
                }}
                style={{
                  display: 'block', width: '100%', background: 'transparent', border: 'none',
                  color: 'var(--violet)', padding: '8px 10px', borderRadius: 4, fontSize: 12, cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(140,100,220,0.10)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                + Yeni ürün ekle
              </button>
            </div>
          )}
        </div>
        )}
        {isThinking && (
          <div className="menubar__item menubar__item--thinking">
            <span className="menubar__status-dot menubar__status-dot--violet" />
            <span className="menubar__item-value">Yanıt yazılıyor…</span>
          </div>
        )}
        {!EASY_MODE && <LlmDegradedPill />}
      </div>
      <div className="menubar__spacer" />
      {!EASY_MODE && (
      <div className="menubar__right">
        <div className="menubar__item" title={backend.title}>
          <span className="menubar__status-dot" style={{ background: backend.dot }} />
          <span className="menubar__item-value">{backend.label}</span>
        </div>
      </div>
      )}
    </div>
  );
};

/** Otonom mod — menubar kısayolu */
const AutonomyMenubarPill = () => {
  const autonomyEnabled = useStore((s: any) => s.autonomyEnabled);
  const autonomyStatus = useStore((s: any) => s.autonomyStatus);
  const setCurrentPage = useStore((s: any) => s.setCurrentPage);
  const setAutonomyEnabled = useStore((s: any) => s.setAutonomyEnabled);
  const stale = autonomyStatus?.goal_loop?.stale_count ?? 0;
  const schedulerRunning = autonomyStatus?.scheduler?.running === true;
  const jobCount = autonomyStatus?.job_count ?? 0;
  const tip = autonomyEnabled
    ? `Otonom mod aktif · ${jobCount} zamanlanmış iş${stale ? ` · ${stale} hedef bekliyor` : ''}. Tıkla: Otonom konsol. Shift+tık: modu kapat.`
    : 'Otonom mod kapalı — scheduler duraklatıldı. Tıkla: Otonom konsol. Shift+tık: modu aç.';
  return (
    <button
      type="button"
      className={`menubar__item menubar__item--autonomy ${autonomyEnabled ? 'menubar__item--autonomy-on' : ''}`}
      title={tip}
      onClick={(e) => {
        if (e.shiftKey) {
          void setAutonomyEnabled(!autonomyEnabled);
          return;
        }
        setCurrentPage('autonomy_console');
      }}
    >
      <span
        className={`menubar__status-dot ${autonomyEnabled ? 'menubar__status-dot--acid' : ''} ${autonomyEnabled && schedulerRunning ? 'menubar__autonomy-dot--live' : ''}`}
      />
      <span className="menubar__item-value">{autonomyEnabled ? 'Otonom' : 'Manuel'}</span>
      {autonomyEnabled && stale > 0 && (
        <span className="menubar__autonomy-stale">{stale}</span>
      )}
    </button>
  );
};

/** Persistent menubar pill — visible whenever the backend last reported that
 *  the LLM is in degraded mode (MockProvider in use or Gemini fallback). */
const LlmDegradedPill = () => {
  const degraded = useStore((s: any) => s.llmDegraded);
  const reason = useStore((s: any) => s.llmDegradedReason);
  if (!degraded) return null;
  const tip = reason === 'gemini_quota_exhausted'
    ? 'LLM kotası tükendi — yanıtlar MockProvider fallback ile üretiliyor.'
    : 'AWS_BEARER_TOKEN_BEDROCK yapılandırılmadı — yanıtlar MockProvider tarafından üretiliyor.';
  return (
    <div className="menubar__item menubar__item--degraded" title={tip}>
      <span className="menubar__status-dot menubar__status-dot--amber" />
      <span className="menubar__item-value">Mock LLM</span>
    </div>
  );
};

// ============================================================
// Sidebar
// ============================================================

const Sidebar = ({ active, onNavigate }) => {
  const agents = useStore((s) => s.agents);
  const approvals = useStore((s) => s.approvals);
  const tools = useStore((s) => s.tools);
  const tasks = useStore((s) => s.tasks);
  const activeProduct = useStore((s) => s.onboardedProduct);
  const products = useStore((s: any) => s.products);
  const autonomyStatus = useStore((s: any) => s.autonomyStatus);
  const switchToProduct = useStore((s: any) => s.switchToProduct);
  const startNewProductOnboarding = useStore((s: any) => s.startNewProductOnboarding);
  const resetTransientState = useStore((s: any) => s.resetTransientState);
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const productMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!productMenuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (productMenuRef.current && !productMenuRef.current.contains(e.target as Node)) setProductMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [productMenuOpen]);

  const pendingApprovals = approvals.filter((a) => a.status === 'pending' || a.status === 'estimating').length;
  const runningTasks = tasks.filter((t) => t.status === 'in_progress' || t.status === 'assigned' || t.status === 'waiting_tool_result').length;
  const liveTools = tools.filter((t) => t.mode === 'live').length;
  const mockTools = tools.length - liveTools;

  const pageBadge = (pageId: string) => {
    if (pageId === 'supervisor') return 'live';
    if (pageId === 'graph' && runningTasks) return String(runningTasks);
    if (pageId === 'office') return String(agents.length);
    if (pageId === 'tasks') {
      if (pendingApprovals) return 'alert:' + pendingApprovals;
      if (runningTasks) return String(runningTasks);
      return null;
    }
    if (pageId === 'autonomy_console') return 'live';
    if (pageId === 'goals') {
      const stale = autonomyStatus?.goal_loop?.stale_count ?? 0;
      if (stale > 0) return `alert:${stale}`;
      return null;
    }
    if (pageId === 'products' && products?.length) return String(products.length);
    if (pageId === 'shopping') return 'new';
    return null;
  };

  const SECTIONS = HUB_SECTIONS.map((sec) => ({
    label: sec.label,
    items: sec.pages.map((p) => ({
      id: p.id,
      label: p.label,
      icon: p.icon,
      badge: pageBadge(p.id),
    })),
  }));

  const productName = activeProduct?.product_name || 'Aktif ürün yok';
  const productSku = activeProduct?.category || '—';
  const productInitials = (activeProduct?.product_name || 'OP').split(/\s+/).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <aside className="sidebar">
      <div ref={productMenuRef} style={{ position: 'relative' }}>
        <button
          type="button"
          className="sidebar__product"
          aria-label="Ürün menüsünü aç"
          aria-haspopup="menu"
          aria-expanded={productMenuOpen}
          onClick={() => setProductMenuOpen((o) => !o)}
          style={{ width: '100%', background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left' }}
        >
          <div className="sidebar__product-thumb">{productInitials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar__product-name">
              {productName}
              <Icon name={productMenuOpen ? 'chevup' : 'chevdown'} size={12} color="var(--fg-3)" />
            </div>
            <div className="sidebar__product-meta">SKU · {productSku}</div>
          </div>
        </button>
        {productMenuOpen && (
          <div
            role="menu"
            style={{
              position: 'absolute', left: 8, right: 8, top: '100%', marginTop: 6, zIndex: 200,
              background: 'var(--bg-1, #0b0b0b)', border: '1px solid var(--border)',
              borderRadius: 6, boxShadow: '0 12px 32px rgba(0,0,0,0.45)', padding: 4,
            }}
          >
            <div className="label-eyebrow" style={{ padding: '6px 10px 4px', color: 'var(--fg-3)' }}>
              ÜRÜNLER ({(products || []).length})
            </div>
            {(products || []).map((p: any) => (
              <button
                key={p.product_name}
                role="menuitem"
                onClick={() => { switchToProduct(p.product_name); setProductMenuOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', background: 'transparent', border: 'none', color: 'var(--fg-1)',
                  padding: '8px 10px', borderRadius: 4, fontSize: 12, cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.product_name}</span>
                {p.product_name === productName && <span className="mono" style={{ fontSize: 9, color: 'var(--acid)' }}>● aktif</span>}
              </button>
            ))}
            {(!products || products.length === 0) && (
              <div className="mono" style={{ padding: '6px 10px', fontSize: 10, color: 'var(--fg-4)' }}>henüz ürün yok</div>
            )}
            <div style={{ height: 1, background: 'var(--border-faint)', margin: '4px 0' }} />
            <button
              role="menuitem"
              onClick={() => { setProductMenuOpen(false); startNewProductOnboarding(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', background: 'transparent', border: 'none',
                color: 'var(--violet)', padding: '8px 10px', borderRadius: 4,
                fontSize: 12, cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(140,100,220,0.10)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Icon name="plus" size={12} /> Yeni ürün ekle
            </button>
            <button
              role="menuitem"
              onClick={() => {
                setProductMenuOpen(false);
                if (confirm('Sohbet, görev, onay ve log geçmişini temizlemek istiyor musun? Ürünler ve marka kimliği korunacak.')) {
                  resetTransientState();
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', background: 'transparent', border: 'none',
                color: 'var(--fg-2)', padding: '8px 10px', borderRadius: 4,
                fontSize: 12, cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Icon name="refresh" size={12} /> Sayfayı sıfırla
            </button>
          </div>
        )}
      </div>
      <nav className="sidebar__nav">
        {SECTIONS.map(sec => (
          <div key={sec.label}>
            <div className="sidebar__section">{sec.label}</div>
            {sec.items.map(it => {
              const isActive = active === it.id || (it.id === 'tasks' && active === 'approvals');
              const isAlert = it.badge && String(it.badge).startsWith('alert:');
              const badgeVal = isAlert ? it.badge.split(':')[1] : it.badge;
              const isLive = it.badge === 'live';
              return (
                <button
                  type="button"
                  key={it.id}
                  className={`nav-item ${isActive ? 'nav-item--active' : ''}`}
                  onClick={() => onNavigate(it.id === 'tasks' && pendingApprovals > 0 ? 'approvals' : it.id)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={it.id === 'supervisor' ? 'Chat' : it.label}
                  style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', font: 'inherit', color: 'inherit', cursor: 'pointer' }}
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
                </button>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="sidebar__footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-2)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--acid)' }} />
          TicOSClaw
        </div>
        <div>{agents.length} ajan · {tools.length} araç</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <span><span style={{ color: 'var(--acid)' }}>●</span> {liveTools} live</span>
          <span><span style={{ color: 'var(--amber)' }}>●</span> {mockTools} mock</span>
        </div>
      </div>
    </aside>
  );
};

// ============================================================
// Bottom Process Strip — Activity Monitor style
// ============================================================
const ProcessStrip = ({ agents, budgetBurn }: { agents: any[]; budgetBurn?: string }) => {
  const tasks = useStore((s: any) => s.tasks);
  const chatProgress = useStore((s: any) => s.chatProgress);
  const isThinking = useStore((s: any) => s.isThinking);

  const liveAgentIds = new Set<string>([
    ...chatProgress.filter((p: any) => p.event === 'agent_started').map((p: any) => p.agent_id).filter(Boolean),
    ...tasks.filter((t: any) => ['in_progress', 'assigned', 'waiting_tool_result'].includes(t.status))
            .map((t: any) => t.assigned_agent_id).filter(Boolean),
  ]);

  for (const p of chatProgress) {
    if (p.event === 'agent_completed' && p.agent_id) liveAgentIds.delete(p.agent_id);
  }

  const active = (
    liveAgentIds.size > 0
      ? agents.filter((a: any) => liveAgentIds.has(a.id))
      : agents.filter((a: any) => a.status === 'running' || a.status === 'busy')
  ).slice(0, 6);

  if (!active.length && !isThinking) {
    return null;
  }

  return (
    <div className="procstrip">
      <div className="procstrip__items">
        {isThinking && (
          <span className="procstrip__item procstrip__item--orchestrator">Orchestrator</span>
        )}
        {active.map(a => (
          <div key={a.pid} className="procstrip__item" title={a.name}>
            <StatusDot status={a.status} size={6} />
            <span>{a.name}</span>
          </div>
        ))}
      </div>
      {budgetBurn && (
        <span className="procstrip__meta tnum" title="Son 1 saat maliyeti">{budgetBurn}</span>
      )}
    </div>
  );
};

// ============================================================
// Command Palette
// ============================================================
const CMD_ITEMS = [
  { group: 'Hızlı Komut', items: [
    { id: 'plan',        title: 'Bugünün planını çıkar',                  hint: 'Supervisor günü planlar' },
    { id: 'sweep',       title: 'Otonom tarama çalıştır',                 hint: 'Envanter sync + düşük risk onay' },
    { id: 'goals-tick',  title: 'Hedef döngüsünü tetikle',                  hint: 'Stale hedefler için ajan görevi' },
    { id: 'pricing',     title: 'Fiyat optimizasyonu çalıştır',           hint: 'Tüm SKU\'lar için rakip taraması' },
    { id: 'reviews',     title: 'Yeni yorumları topla ve yanıtla',        hint: 'Trendyol + Shopify + Hepsiburada' },
    { id: 'reorder',     title: 'Reorder öneri raporu',                   hint: 'Operations + Logistics' },
    { id: 'campaign',    title: 'Yeni Meta kampanyası taslağı',           hint: 'Marketing → Content & SEO' },
  ]},
  { group: 'Navigasyon', items: [
    { id: 'go-dash',     title: 'Ana Sayfa',              hint: 'Özet' },
    { id: 'go-supervisor', title: 'Sohbet',               hint: 'AI asistan' },
    { id: 'go-tic_products', title: 'Stok',               hint: 'Mağaza' },
    { id: 'go-tic_orders', title: 'Siparişler',           hint: 'Mağaza' },
    { id: 'go-approvals', title: 'Görevler',              hint: 'Operasyon' },
    { id: 'go-office',   title: 'Ajanlar',                hint: 'Operasyon' },
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
      const target = it.id.replace('go-', '').replace('dash', 'dashboard').replace('supervisor', 'supervisor');
      onNavigate(target);
    } else if (it.id === 'sweep') {
      void useStore.getState().runAutonomySweep();
    } else if (it.id === 'goals-tick') {
      void useStore.getState().runGoalLoopTick();
    } else {
      // Hızlı komut: supervisor sayfasına geç + mesajı backend'e yolla
      onNavigate('supervisor');
      useStore.getState().sendUserMessageStream(it.title).catch(() => useStore.getState().sendUserMessage(it.title));
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
        </div>
      </div>
    </div>
  );
};

export { Menubar, Sidebar, ProcessStrip, CmdPalette };
