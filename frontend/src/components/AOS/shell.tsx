// @ts-nocheck
// ============================================================
// AGENT.OS — Shell: Menubar, Sidebar, ProcessStrip, CmdPalette
// ============================================================
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Icon, StatusDot, AgentAvatar } from '@/components/AOS/widgets';
import { useStore } from '@/stores/useStore';

const SUGGESTIONS = [
  'Bugün için günün planını çıkar',
  'Bekleyen tüm onayları onayla',
  'Marka kimliğini yeniden üret',
  'En kritik 3 görev hangisi?',
  'Anomalileri göster',
  'Tüm entegrasyonları senkronize et',
];

// ============================================================
// Top Menubar — macOS-style system status
// ============================================================
const STAGE_LABELS: Record<string, string> = {
  idea: 'Fikir',
  product_no_store: 'Ürün Hazır',
  store_growing: 'Mağaza Büyüyor',
  marketplace_opt: 'Ölçeklendirme',
};

const Menubar = ({ sysClock, runningCount, busyCount, budgetBurn, confidence, onCmd }) => {
  const product = useStore((s: any) => s.onboardedProduct);
  const isThinking = useStore((s: any) => s.isThinking);
  const dashboard = useStore((s: any) => s.dashboard);
  const backendStatus = useStore((s: any) => s.backendStatus);
  const fallbackActive = useStore((s: any) => s.fallbackActive);
  const products = useStore((s: any) => s.products);
  const switchToProduct = useStore((s: any) => s.switchToProduct);
  const setCurrentPage = useStore((s: any) => s.setCurrentPage);
  const setOnboardingStep = useStore((s: any) => s.setOnboardingStep);
  const resetOnboardingDraft = useStore((s: any) => s.resetOnboardingDraft);
  const sendUserMessage = useStore((s: any) => s.sendUserMessage);
  const productName = product?.product_name || 'Ürün yok';
  const market = product?.target_market || '—';
  const stageLabel = product ? (STAGE_LABELS[product.stage] || product.stage) : '—';
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [suggestionIdx, setSuggestionIdx] = useState(0);
  const switcherRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = setInterval(() => setSuggestionIdx((i) => (i + 1) % SUGGESTIONS.length), 6000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!switcherOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) setSwitcherOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [switcherOpen]);
  const backend = (() => {
    if (backendStatus === 'online') return { text: 'Backend: online', dot: 'var(--acid)', title: 'Backend ulaşılabilir' };
    if (backendStatus === 'offline') return {
      text: `Backend: çevrimdışı${fallbackActive ? ' — fallback aktif' : ''}`,
      dot: fallbackActive ? 'var(--amber)' : '#ef4444',
      title: fallbackActive ? 'Backend çevrimdışı — Gemini fallback aktif.' : 'Backend çevrimdışı — AI çağrıları başarısız olacak.',
    };
    return { text: 'Backend: kontrol ediliyor', dot: 'var(--fg-3)', title: 'Backend durumu kontrol ediliyor' };
  })();
  return (
    <div className="menubar">
      <div className="menubar__brand">
        <span className="menubar__brand-mark" />
        <span>AGENT.OS</span>
        <span style={{ color: 'var(--fg-3)', fontWeight: 400, marginLeft: 4 }}>OneProduct</span>
      </div>
      <div className="menubar__sep" />
      <div className="menubar__items">
        <div className="menubar__item" ref={switcherRef} style={{ position: 'relative' }}>
          <span className="menubar__item-label">Aktif Ürün</span>
          <button
            type="button"
            aria-label={`Aktif ürünü değiştir: ${productName}`}
            aria-haspopup="listbox"
            aria-expanded={switcherOpen}
            onClick={() => setSwitcherOpen((o) => !o)}
            style={{
              background: 'transparent', border: 'none', color: 'inherit',
              font: 'inherit', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4,
            }}
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
                  // Clear any leftover wizard state — fixes pre-fill leak (#19).
                  resetOnboardingDraft?.();
                  setSwitcherOpen(false);
                  setOnboardingStep?.(1);
                  setCurrentPage('onboarding');
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
        <div className="menubar__item menubar__item--md-hide" title={`Pazar: ${market}`}>
          <span className="menubar__item-label">Pazar</span>
          <span className="menubar__item-value">{market}</span>
        </div>
        <div className="menubar__item menubar__item--lg-hide" title={`Aşama: ${stageLabel}`}>
          <span className="menubar__item-label">Aşama</span>
          <span className="menubar__item-value">{stageLabel}</span>
        </div>
        {isThinking && (
          <div className="menubar__item">
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--violet)', boxShadow: '0 0 6px var(--violet)' }} />
            <span className="menubar__item-value mono" style={{ color: 'var(--violet)' }}>HERMES ÇALIŞIYOR</span>
          </div>
        )}
        <LlmDegradedPill />
      </div>
      <div className="menubar__spacer" />
      <div className="menubar__right">
        <button
          type="button"
          aria-label="Komut paletini aç"
          title="Komut paletini aç (Ctrl/⌘+K)"
          onClick={onCmd}
          className="menubar__item"
          style={{ background: 'transparent', border: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer' }}
        >
          <Icon name="search" size={12} color="var(--fg-3)" />
          <span className="menubar__item-label">Komut</span>
          <span className="btn__kbd" style={{ marginLeft: 2 }}>⌘K</span>
        </button>
        <button
          type="button"
          title="Bu öneriyi Supervisor'a gönder"
          onClick={() => sendUserMessage?.(SUGGESTIONS[suggestionIdx])}
          className="menubar__item"
          style={{
            background: 'rgba(140,100,220,0.10)', border: '1px solid rgba(140,100,220,0.25)',
            color: 'var(--violet)', font: 'inherit', cursor: 'pointer',
            padding: '2px 8px', borderRadius: 4, maxWidth: 240,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}
        >
          {SUGGESTIONS[suggestionIdx]}
        </button>
        <div className="menubar__item" title={backend.title}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: backend.dot, boxShadow: `0 0 6px ${backend.dot}` }} />
          <span className="menubar__item-value">{backend.text}</span>
        </div>
        <div className="menubar__item">
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--acid)', boxShadow: '0 0 6px var(--acid)' }} />
          <span className="menubar__item-value tnum">{runningCount} çalışıyor</span>
        </div>
        <div className="menubar__item menubar__item--md-hide" title={`${busyCount} meşgul`}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)' }} />
          <span className="menubar__item-value tnum">{busyCount} meşgul</span>
        </div>
        <div className="menubar__item menubar__item--lg-hide" title={`Bütçe: ${budgetBurn}`}>
          <span className="menubar__item-label">Bütçe</span>
          <span className="menubar__item-value">{budgetBurn}</span>
        </div>
        <div className="menubar__item menubar__item--lg-hide" title={`Confidence: ${confidence}`}>
          <span className="menubar__item-label">Conf</span>
          <span className="menubar__item-value">{confidence}</span>
        </div>
        <div className="menubar__item menubar__item--sm-hide" title={`Saat: ${sysClock}`}>
          <span className="menubar__item-value tnum">{sysClock}</span>
        </div>
      </div>
    </div>
  );
};

/** Persistent menubar pill — visible whenever the backend last reported that
 *  the LLM is in degraded mode (MockProvider in use or Gemini fallback). */
const LlmDegradedPill = () => {
  const degraded = useStore((s: any) => s.llmDegraded);
  const reason = useStore((s: any) => s.llmDegradedReason);
  if (!degraded) return null;
  const tip = reason === 'gemini_quota_exhausted'
    ? 'Gemini kotası tükendi — yanıtlar MockProvider fallback ile üretiliyor.'
    : 'GEMINI_API_KEY yapılandırılmadı — yanıtlar MockProvider tarafından üretiliyor.';
  return (
    <div className="menubar__item" title={tip} style={{ borderRadius: 4, background: 'rgba(255,177,61,0.12)', border: '1px solid rgba(255,177,61,0.35)' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)', boxShadow: '0 0 6px var(--amber)' }} />
      <span className="menubar__item-value mono" style={{ color: 'var(--amber)' }}>MOCK LLM</span>
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
  const agents = useStore((s) => s.agents);
  const approvals = useStore((s) => s.approvals);
  const tools = useStore((s) => s.tools);
  const tasks = useStore((s) => s.tasks);
  const activeProduct = useStore((s) => s.onboardedProduct);
  const products = useStore((s: any) => s.products);
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

  const SECTIONS = [
    {
      label: 'Sistem',
      items: [
        { id: 'dashboard',  label: 'Dashboard',         icon: 'dashboard' },
        { id: 'supervisor', label: 'Supervisor',        icon: 'chat', badge: 'live' },
        { id: 'graph',      label: 'Görev Grafiği',     icon: 'graph', badge: runningTasks ? String(runningTasks) : null },
      ],
    },
    {
      label: 'Ajan Altyapısı',
      items: [
        { id: 'office',     label: 'Agent Office',      icon: 'agents', badge: String(agents.length) },
        { id: 'org',        label: 'Org Şeması',        icon: 'agents' },
        { id: 'goals',      label: 'Hedefler',          icon: 'graph' },
        { id: 'budgets',    label: 'Bütçeler',          icon: 'money' },
        { id: 'llm_config', label: 'LLM Modelleri',     icon: 'tools' },
        { id: 'tasks',      label: 'Görevler',          icon: 'graph', badge: runningTasks ? String(runningTasks) : null },
        { id: 'approvals',  label: 'Onaylar',           icon: 'approvals', badge: pendingApprovals ? 'alert:' + pendingApprovals : null },
        { id: 'tools',      label: 'Araçlar',           icon: 'tools' },
        { id: 'integrations', label: 'Entegrasyonlar',  icon: 'tools' },
        { id: 'audit',      label: 'Audit Log',         icon: 'audit' },
        { id: 'autonomy_console', label: 'Autonomy Console', icon: 'zap', badge: 'live' },
      ],
    },
    {
      label: 'Ürün OS',
      items: [
        { id: 'products',   label: 'Ürünler',           icon: 'bag', badge: products && products.length ? String(products.length) : null },
        { id: 'brand',      label: 'Marka',             icon: 'brand' },
        { id: 'pricing',    label: 'Fiyat & Finans',    icon: 'money' },
        { id: 'growth',     label: 'Büyüme',            icon: 'growth' },
        { id: 'onboarding', label: 'Onboarding',        icon: 'onboarding' },
      ],
    },
  ];

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
              const isActive = active === it.id;
              const isAlert = it.badge && String(it.badge).startsWith('alert:');
              const badgeVal = isAlert ? it.badge.split(':')[1] : it.badge;
              const isLive = it.badge === 'live';
              return (
                <button
                  type="button"
                  key={it.id}
                  className={`nav-item ${isActive ? 'nav-item--active' : ''}`}
                  onClick={() => onNavigate(it.id)}
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
          Hermes · OpenClaw
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
  const auditLogs = useStore((s: any) => s.auditLogs);
  const isThinking = useStore((s: any) => s.isThinking);

  // Active = agents currently running progress events OR have an in-progress task.
  const liveAgentIds = new Set<string>([
    ...chatProgress.filter((p: any) => p.event === 'agent_started').map((p: any) => p.agent_id).filter(Boolean),
    ...tasks.filter((t: any) => ['in_progress', 'assigned', 'waiting_tool_result'].includes(t.status))
            .map((t: any) => t.assigned_agent_id).filter(Boolean),
  ]);

  // Strip out agents marked completed during this run.
  for (const p of chatProgress) {
    if (p.event === 'agent_completed' && p.agent_id) liveAgentIds.delete(p.agent_id);
  }

  const active = (
    liveAgentIds.size > 0
      ? agents.filter((a: any) => liveAgentIds.has(a.id))
      : agents.filter((a: any) => a.status === 'running' || a.status === 'busy')
  ).slice(0, 8);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1200);
    return () => clearInterval(id);
  }, []);
  // Per-agent load: in-progress task count → 35-95% mapped, with a tiny pulse.
  const driftedLoad = (a: any) => {
    const myTasks = tasks.filter((t: any) => t.assigned_agent_id === a.id && ['in_progress', 'assigned', 'waiting_tool_result'].includes(t.status)).length;
    const base = liveAgentIds.has(a.id) ? 55 + Math.min(40, myTasks * 12) : Math.min(40, myTasks * 10) + 8;
    const seed = (a.pid.charCodeAt(2) + tick) % 7;
    return Math.max(6, Math.min(96, base + (seed - 3)));
  };

  const recentToolCalls = chatProgress.filter((p: any) => p.event === 'tool_called').length;
  const totalCalls = recentToolCalls > 0 ? recentToolCalls : Math.min(99, auditLogs.length);
  const activeDag = isThinking ? 1 : 0;
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
          <span>orchestrator: <span style={{ color: 'var(--fg-1)' }} className="tnum">{activeDag}</span> dag · <span style={{ color: 'var(--fg-1)' }} className="tnum">{totalCalls}</span> tool calls</span>
        </div>
        <div className="procstrip__sys-item">
          <Icon name="zap" size={12} color="var(--amber)" />
          <span style={{ color: 'var(--fg-1)' }} className="tnum">{budgetBurn || '$0.00/h'}</span>
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
          <span style={{ marginLeft: 'auto', color: 'var(--acid)' }}>● Hermes hazır</span>
        </div>
      </div>
    </div>
  );
};

export { Menubar, Sidebar, ProcessStrip, CmdPalette };
