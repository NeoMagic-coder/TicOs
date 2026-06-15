// @ts-nocheck
// ============================================================
// AGENT.OS — Main App entry (store-integrated)
// ============================================================
import React, { useState, useEffect, useRef } from 'react';
import { Menubar, ProcessStrip } from '@/components/AOS/shell';
import DashboardPage from '@/pages/DashboardPage';
import SimpleHomePage from '@/pages/SimpleHomePage';
import SupervisorPage from '@/pages/ChatPage';
import GraphPage from '@/pages/GraphPage';
import OfficePage from '@/pages/AgentsPage';
import WorkQueuePage from '@/pages/WorkQueuePage';
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
import TicProductsPage from '@/pages/TicProductsPage';
import TicOrdersPage from '@/pages/TicOrdersPage';
import ShoppingAgentPage from '@/pages/ShoppingAgentPage';
import CommerceControlPage from '@/pages/CommerceControlPage';
import WallpapersPage from '@/pages/WallpapersPage';
import { IntegrationsPage } from '@/pages/legacy/IntegrationsPage';
import { ToastStack } from '@/components/AOS/Toast';
import { SupervisorChatDock } from '@/components/SupervisorChatDock';
import { useAdaptedAgents, useStorePage, useOnboardingGate } from '@/lib/aos/adapter';
import { OnboardingPage as RealOnboardingPage } from '@/pages/OnboardingPage';
import UnifiedConsolePage from '@/pages/UnifiedConsolePage';
import { isHubPage } from '@/lib/navigation/hubs';
import { WallpaperBackground } from '@/components/wallpapers/WallpaperBackground';
import EasyFeaturesPage from '@/pages/easy/EasyFeaturesPage';
import { EASY_MODE } from '@/lib/easyMode';
import { useStore } from '@/stores/useStore';
import { GuideAssistant } from '@/components/guide/GuideAssistant';

const PAGES: Record<string, any> = {
  dashboard:  EASY_MODE ? EasyFeaturesPage : SimpleHomePage,
  dashboard_full: DashboardPage,
  supervisor: SupervisorPage,
  chat:       SupervisorPage,
  graph:      GraphPage,
  office:     OfficePage,
  agents:     OfficePage,
  approvals:  WorkQueuePage,
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
  tasks:      WorkQueuePage,
  integrations: IntegrationsPage,
  easy_features: EasyFeaturesPage,
  onboarding: RealOnboardingPage,
  tic_products: TicProductsPage,
  tic_orders: TicOrdersPage,
  shopping: ShoppingAgentPage,
  commerce_control: CommerceControlPage,
  wallpapers: WallpapersPage,
  console: DashboardPage,
};

const PLACEHOLDER_LABELS: Record<string, string> = {
  reviews:     'Yorumlar',
  influencers: 'Influencer & PR',
  email_flows: 'E-posta Akışları',
  autonomy:    'Otonomi',
  scheduler:   'Zamanlayıcı',
  tasks:       'Görevler & Onaylar',
  knowledge:   'Bilgi Tabanı',
  analytics:   'Analitik',
  integrations:'Entegrasyonlar',
  settings:    'Ayarlar',
};

const PlaceholderPage = ({ name }: { name: string }) => (
  <div className="page page--placeholder">
    <h1 className="page__title">{name}</h1>
    <p className="page__sub">Bu ekran yakında kullanıma açılacak.</p>
  </div>
);

const App = () => {
  const [route, setRoute] = useStorePage();
  const showOnboarding = useOnboardingGate();
  const adaptedAgents = useAdaptedAgents();
  // All store reads MUST happen unconditionally before any early return
  // (Rules of Hooks). The onboarding gate is enforced after these reads.
  const auditLogs = useStore((s: any) => s.auditLogs);
  const isThinking = useStore((s: any) => s.isThinking);
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
  const refreshAllModules = useStore((s: any) => s.refreshAllModules);
  const loadAutonomyStatus = useStore((s: any) => s.loadAutonomyStatus);
  const loadApprovalsFromBackend = useStore((s: any) => s.loadApprovalsFromBackend);
  const fetchIntegrations = useStore((s: any) => s.fetchIntegrations);
  useEffect(() => {
    void pingBackend();
    void loadTools();
    void hydrateFromBackend();
    void fetchIntegrations();
    void loadAutonomyStatus().then(() => {
      const s = useStore.getState();
      if (s.onboardingComplete && !s.autonomyEnabled) {
        void s.setAutonomyEnabled(true);
      }
    });
    void refreshAllModules();
    const pingId = setInterval(() => void pingBackend(), 20000);
    const approvalsId = setInterval(() => {
      void loadApprovalsFromBackend();
    }, 20000);
    const syncId = setInterval(() => {
      void refreshAllModules();
    }, 30000);
    const autonomyId = setInterval(() => {
      void loadAutonomyStatus();
    }, 60000);
    return () => {
      clearInterval(pingId);
      clearInterval(approvalsId);
      clearInterval(syncId);
      clearInterval(autonomyId);
    };
  }, [pingBackend, loadTools, hydrateFromBackend, refreshAllModules, loadAutonomyStatus, loadApprovalsFromBackend, fetchIntegrations]);

  // URL pathname ⇆ currentPage. Single source-of-truth effect to avoid the
  // race where the mirror effect runs with the stale (persisted) route on
  // mount and overwrites a deep link like /autonomy.
  const URL_TO_PAGE: Record<string, string> = {
    '': 'dashboard',
    'dashboard': 'dashboard', 'dashboard_full': 'dashboard_full', 'dashboard-full': 'dashboard_full', 'chat': 'chat', 'supervisor': 'supervisor',
    'graph': 'graph', 'office': 'office', 'agents': 'agents',
    'approvals': 'approvals', 'tools': 'tools', 'audit': 'audit',
    'brand': 'brand', 'pricing': 'pricing', 'growth': 'growth',
    'org': 'org', 'goals': 'goals', 'budgets': 'budgets',
    'llm_config': 'llm_config', 'llm-config': 'llm_config',
    'products': 'products',
    'autonomy': 'autonomy_console',
    'autonomy_console': 'autonomy_console',
    'autonomy-console': 'autonomy_console',
    'tasks': 'tasks',     'integrations': 'integrations', 'onboarding': 'onboarding',
    'tic_products': 'tic_products', 'tic-products': 'tic_products',
    'tic_orders': 'tic_orders', 'tic-orders': 'tic_orders',
    'shopping': 'shopping', 'alisveris': 'shopping',
    'commerce_control': 'commerce_control', 'commerce-control': 'commerce_control',
    'wallpapers': 'wallpapers',
    'console': 'console',
    'easy_features': 'dashboard', 'easy-features': 'dashboard', 'tum-ozellikler': 'dashboard',
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

  const showProcStrip = !EASY_MODE && (runningCount > 0 || busyCount > 0 || isThinking);

  const Page = PAGES[route];
  const useUnifiedShell = Page && isHubPage(route);

  return (
    <div className={`app-root ${showProcStrip ? '' : 'app-root--compact'} ${EASY_MODE ? 'app-root--easy app-root--no-menubar' : ''}`.trim()}>
      <WallpaperBackground />
      {!EASY_MODE && (
      <Menubar
        sysClock={clock}
        runningCount={runningCount}
        busyCount={busyCount}
      />
      )}
      <div className="app-frame">
        <main className="main" key={route}>
          {useUnifiedShell ? (
            <UnifiedConsolePage pageId={route} navigate={setRoute} PageComponent={Page} />
          ) : Page ? (
            <Page navigate={setRoute} />
          ) : (
            <PlaceholderPage name={PLACEHOLDER_LABELS[route] || route} />
          )}
        </main>
      </div>
      {!EASY_MODE && <ProcessStrip agents={adaptedAgents} budgetBurn={budgetBurn} />}
      {!EASY_MODE && <SupervisorChatDock />}
      {EASY_MODE && !showOnboarding && <GuideAssistant />}
      <ToastStack />
    </div>
  );
};

export default App;
