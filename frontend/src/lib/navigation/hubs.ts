/** Unified console navigation — hub sections + page metadata. */

export type HubPageDef = {
  id: string;
  label: string;
  icon?: string;
};

export type HubSection = {
  id: string;
  label: string;
  defaultPage: string;
  pages: HubPageDef[];
};

const PAGE_DEFS: Record<string, HubPageDef> = {
  dashboard: { id: 'dashboard', label: 'Dashboard', icon: 'grid' },
  supervisor: { id: 'supervisor', label: 'Supervisor', icon: 'zap' },
  chat: { id: 'chat', label: 'Supervisor', icon: 'zap' },
  graph: { id: 'graph', label: 'Görev Grafiği', icon: 'flow' },
  office: { id: 'office', label: 'Agent Office', icon: 'users' },
  agents: { id: 'agents', label: 'Agent Office', icon: 'users' },
  tasks: { id: 'tasks', label: 'Görevler & Onaylar', icon: 'check' },
  approvals: { id: 'approvals', label: 'Onaylar', icon: 'check' },
  tools: { id: 'tools', label: 'Araçlar', icon: 'wrench' },
  audit: { id: 'audit', label: 'Audit Log', icon: 'terminal' },
  brand: { id: 'brand', label: 'Marka', icon: 'sparkles' },
  pricing: { id: 'pricing', label: 'Fiyatlandırma', icon: 'money' },
  growth: { id: 'growth', label: 'Büyüme', icon: 'growth' },
  org: { id: 'org', label: 'Organizasyon', icon: 'building' },
  goals: { id: 'goals', label: 'Hedefler', icon: 'target' },
  budgets: { id: 'budgets', label: 'Bütçeler', icon: 'wallet' },
  llm_config: { id: 'llm_config', label: 'LLM Ayarları', icon: 'cpu' },
  products: { id: 'products', label: 'Ürün OS', icon: 'box' },
  autonomy_console: { id: 'autonomy_console', label: 'Otonomi', icon: 'shield' },
  tic_products: { id: 'tic_products', label: 'Envanter', icon: 'package' },
  tic_orders: { id: 'tic_orders', label: 'Siparişler', icon: 'bag' },
  shopping: { id: 'shopping', label: 'Alışveriş Ajanı', icon: 'search' },
  integrations: { id: 'integrations', label: 'Entegrasyonlar', icon: 'plug' },
};

export const HUB_SECTIONS: HubSection[] = [
  {
    id: 'system',
    label: 'Sistem',
    defaultPage: 'dashboard',
    pages: [
      PAGE_DEFS.dashboard,
      PAGE_DEFS.audit,
      PAGE_DEFS.org,
      PAGE_DEFS.goals,
      PAGE_DEFS.budgets,
      PAGE_DEFS.llm_config,
    ],
  },
  {
    id: 'agents',
    label: 'Ajan',
    defaultPage: 'supervisor',
    pages: [
      PAGE_DEFS.supervisor,
      PAGE_DEFS.graph,
      PAGE_DEFS.office,
      PAGE_DEFS.tasks,
      PAGE_DEFS.tools,
    ],
  },
  {
    id: 'product',
    label: 'Ürün OS',
    defaultPage: 'products',
    pages: [PAGE_DEFS.products, PAGE_DEFS.brand, PAGE_DEFS.pricing, PAGE_DEFS.growth],
  },
  {
    id: 'inventory',
    label: 'Envanter',
    defaultPage: 'tic_products',
    pages: [PAGE_DEFS.tic_products, PAGE_DEFS.tic_orders],
  },
  {
    id: 'ticosclaw',
    label: 'TicOSClaw',
    defaultPage: 'shopping',
    pages: [PAGE_DEFS.shopping, PAGE_DEFS.autonomy_console],
  },
];

const HUB_PAGE_IDS = new Set(
  HUB_SECTIONS.flatMap((s) => s.pages.map((p) => p.id)).concat(['chat', 'agents', 'approvals']),
);

const PAGE_ALIASES: Record<string, string> = {
  chat: 'supervisor',
  agents: 'office',
  approvals: 'tasks',
};

export function resolveHubPage(pageId: string): string {
  return PAGE_ALIASES[pageId] || pageId;
}

export function getPageDef(pageId: string): HubPageDef | undefined {
  const key = resolveHubPage(pageId);
  return PAGE_DEFS[key] || PAGE_DEFS[pageId];
}

export function getSectionForPage(pageId: string): HubSection {
  const key = resolveHubPage(pageId);
  return (
    HUB_SECTIONS.find((s) => s.pages.some((p) => p.id === key)) ||
    HUB_SECTIONS[0]
  );
}

export function isHubPage(pageId: string): boolean {
  if (pageId === 'onboarding') return false;
  const key = resolveHubPage(pageId);
  return HUB_PAGE_IDS.has(key) || HUB_PAGE_IDS.has(pageId);
}
