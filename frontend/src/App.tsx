// @ts-nocheck
// ============================================================
// AGENT.OS — Main App entry (store-integrated)
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import { Menubar, Sidebar, ProcessStrip, CmdPalette } from '@/components/AOS/shell';
import DashboardPage from '@/pages/DashboardPage';
import SupervisorPage from '@/pages/ChatPage';
import GraphPage from '@/pages/GraphPage';
import OfficePage from '@/pages/AgentsPage';
import ApprovalsPage from '@/pages/ApprovalsPage';
import ToolsPage from '@/pages/ToolsPage';
import AuditPage from '@/pages/AuditPage';
import BrandPage from '@/pages/BrandPage';
import PricingPage from '@/pages/PricingPage';
import GrowthPage from '@/pages/GrowthPage';
import OrgPage from '@/pages/OrgPage';
import GoalsPage from '@/pages/GoalsPage';
import BudgetsPage from '@/pages/BudgetsPage';
import LLMConfigPage from '@/pages/LLMConfigPage';
import ProductsPage from '@/pages/ProductsPage';
import AutonomyConsolePage from '@/pages/AutonomyConsolePage';
import { TasksPage } from '@/pages/legacy/TasksPage';
import { IntegrationsPage } from '@/pages/legacy/IntegrationsPage';
import Tweaks from '@/components/AOS/tweaks';
import { ToastStack } from '@/components/AOS/Toast';
import { SupervisorChatDock } from '@/components/SupervisorChatDock';
import VoiceDock from '@/components/VoiceDock';
import { useAdaptedAgents, useStorePage, useOnboardingGate } from '@/lib/aos/adapter';
import { OnboardingPage as RealOnboardingPage } from '@/pages/OnboardingPage';
import { useStore } from '@/stores/useStore';

const PAGES: Record<string, any> = {
  dashboard:  DashboardPage,
  supervisor: SupervisorPage,
  chat:       SupervisorPage,
  graph:      GraphPage,
  office:     OfficePage,
  agents:     OfficePage,
  approvals:  ApprovalsPage,
  tools:      ToolsPage,
  audit:      AuditPage,
  brand:      BrandPage,
  pricing:    PricingPage,
  growth:     GrowthPage,
  org:        OrgPage,
  goals:      GoalsPage,
  budgets:    BudgetsPage,
  llm_config: LLMConfigPage,
  products:   ProductsPage,
  autonomy_console: AutonomyConsolePage,
  tasks:      TasksPage,
  integrations: IntegrationsPage,
  onboarding: RealOnboardingPage,
};

const PLACEHOLDER_LABELS: Record<string, string> = {
  reviews:     'Yorumlar',
  influencers: 'Influencer & PR',
  email_flows: 'E-posta Akışları',
  autonomy:    'Otonomi',
  scheduler:   'Zamanlayıcı',
  tasks:       'Görevler',
  knowledge:   'Bilgi Tabanı',
  analytics:   'Analitik',
  integrations:'Entegrasyonlar',
  settings:    'Ayarlar',
};

const PlaceholderPage = ({ name }: { name: string }) => (
  <div className="page">
    <div className="page__breadcrumb mono">HOME <span>›</span> {name.toUpperCase()}</div>
    <div className="page__header">
      <div>
        <h1 className="page__title">
          {name}
          <span className="page__title-tag">YAPIM AŞAMASINDA</span>
        </h1>
        <p className="page__sub">Bu ekran çok yakında — şu an dashboard üzerinde çalışıyoruz.</p>
      </div>
    </div>
    <div className="panel">
      <div className="panel__body">
        <pre className="term" style={{ margin: 0 }}>
{`╭─ agent.os ────────────────────────────╮
│ ${name.padEnd(38)}│
│ status: scaffold                      │
│ next: build interactions              │
╰───────────────────────────────────────╯`}
        </pre>
      </div>
    </div>
  </div>
);

const App = () => {
  const [route, setRoute] = useStorePage();
  const showOnboarding = useOnboardingGate();
  const adaptedAgents = useAdaptedAgents();
  // All store reads MUST happen unconditionally before any early return
  // (Rules of Hooks). The onboarding gate is enforced after these reads.
  const tasks = useStore((s: any) => s.tasks);
  const auditLogs = useStore((s: any) => s.auditLogs);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [clock, setClock] = useState(() => new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));

  useEffect(() => {
    const id = setInterval(() => {
      setClock(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Health check + manifest sync + Phase-3 re-hydration from the backend.
  // Previously the AOS shell didn't call any of these (the legacy
  // ProductContextBar used to own them), so a reload lost everything and the
  // backend status pill stayed 'unknown' forever.
  const pingBackend = useStore((s: any) => s.pingBackend);
  const loadTools = useStore((s: any) => s.loadTools);
  const hydrateFromBackend = useStore((s: any) => s.hydrateFromBackend);
  const fetchIntegrations = useStore((s: any) => s.fetchIntegrations);
  useEffect(() => {
    void pingBackend();
    void loadTools();
    void hydrateFromBackend();
    void fetchIntegrations();
    const id = setInterval(() => void pingBackend(), 20000);
    return () => clearInterval(id);
  }, [pingBackend, loadTools, hydrateFromBackend, fetchIntegrations]);

  // URL pathname ⇆ currentPage. Single source-of-truth effect to avoid the
  // race where the mirror effect runs with the stale (persisted) route on
  // mount and overwrites a deep link like /autonomy.
  const URL_TO_PAGE: Record<string, string> = {
    '': 'dashboard',
    'dashboard': 'dashboard', 'chat': 'chat', 'supervisor': 'supervisor',
    'graph': 'graph', 'office': 'office', 'agents': 'agents',
    'approvals': 'approvals', 'tools': 'tools', 'audit': 'audit',
    'brand': 'brand', 'pricing': 'pricing', 'growth': 'growth',
    'org': 'org', 'goals': 'goals', 'budgets': 'budgets',
    'llm_config': 'llm_config', 'llm-config': 'llm_config',
    'products': 'products',
    'autonomy': 'autonomy_console',
    'autonomy_console': 'autonomy_console',
    'autonomy-console': 'autonomy_console',
    'tasks': 'tasks', 'integrations': 'integrations', 'onboarding': 'onboarding',
  };
  const PAGE_TO_SLUG: Record<string, string> = { autonomy_console: 'autonomy' };
  const slugForPage = (p: string) => PAGE_TO_SLUG[p] || p;

  // Mount: parse pathname, set route if it differs. Use a ref to track
  // whether the initial URL→state import has happened so the mirror branch
  // doesn't race with it.
  const urlImportedRef = useRef(false);
  useEffect(() => {
    const slugFromPath = () => window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    const applyFromUrl = () => {
      const key = URL_TO_PAGE[slugFromPath()];
      urlImportedRef.current = true;
      if (key && key !== route) setRoute(key);
    };
    applyFromUrl();
    window.addEventListener('popstate', applyFromUrl);
    return () => window.removeEventListener('popstate', applyFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!urlImportedRef.current) return; // wait until URL→state ran once
    const desired = `/${slugForPage(route)}`;
    if (window.location.pathname !== desired) {
      window.history.replaceState(null, '', desired);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // Ctrl/Cmd+K is owned by SupervisorChatDock (it toggles the dock). The
  // legacy CmdPalette is still available via the menubar button below.

  if (showOnboarding) {
    return (
      <>
        <RealOnboardingPage />
        <ToastStack />
      </>
    );
  }

  const runningCount = adaptedAgents.filter((a: any) => a.status === 'running').length;
  const busyCount = adaptedAgents.filter((a: any) => a.status === 'busy').length;
  const lastTaskConfidence = (() => {
    const withConf = tasks.filter((t: any) => t.confidence != null).slice(-1)[0];
    return withConf?.confidence?.toFixed(2);
  })();
  const lastHourCost = (() => {
    const cutoff = Date.now() - 3600 * 1000;
    let cost = 0;
    for (const log of auditLogs) {
      const t = new Date(log.timestamp).getTime();
      if (t < cutoff) continue;
      const c = (log.metadata as any)?.cost_usd;
      if (typeof c === 'number') cost += c;
    }
    return cost;
  })();
  const budgetBurn = '$' + lastHourCost.toFixed(2) + '/h';
  const confidence = lastTaskConfidence ?? '—';

  const Page = PAGES[route];

  return (
    <div className="app-root">
      <Menubar
        sysClock={clock}
        runningCount={runningCount}
        busyCount={busyCount}
        budgetBurn={budgetBurn}
        confidence={confidence}
        onCmd={() => setCmdOpen(true)}
      />
      <div className="app-frame">
        <Sidebar active={route} onNavigate={setRoute} />
        <main className="main" key={route}>
          {Page ? <Page navigate={setRoute} /> : <PlaceholderPage name={PLACEHOLDER_LABELS[route] || route} />}
        </main>
      </div>
      <ProcessStrip agents={adaptedAgents} budgetBurn={budgetBurn} />
      <CmdPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onNavigate={setRoute} />
      <SupervisorChatDock />
      <VoiceDock />
      <Tweaks />
      <ToastStack />
    </div>
  );
};

export default App;
