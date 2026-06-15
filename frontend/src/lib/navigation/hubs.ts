export interface HubPageDef {
  id: string;
  label: string;
  icon: string;
  description?: string;
}

export interface HubSection {
  id: string;
  label: string;
  defaultPage: string;
  pages: HubPageDef[];
}

/** Nadiren kullanılan sayfalar — "Diğer" menüsünde. */
export const ADVANCED_PAGES: HubPageDef[] = [
  { id: 'products', label: 'Ürün Kurulum', icon: 'box' },
  { id: 'brand', label: 'Marka', icon: 'sparkles' },
  { id: 'pricing', label: 'Fiyat', icon: 'money' },
  { id: 'growth', label: 'Büyüme', icon: 'trend' },
  { id: 'shopping', label: 'Fiyat Araştır', icon: 'search' },
  { id: 'approvals', label: 'Görevler & Onaylar', icon: 'check' },
  { id: 'office', label: 'Ajanlar', icon: 'users' },
  { id: 'autonomy_console', label: 'Otonomi', icon: 'bot' },
  { id: 'dashboard_full', label: 'Detaylı Panel', icon: 'activity' },
  { id: 'graph', label: 'Görev Grafiği', icon: 'flow' },
  { id: 'tools', label: 'Araçlar', icon: 'wrench' },
  { id: 'audit', label: 'Kayıt', icon: 'terminal' },
  { id: 'org', label: 'Organizasyon', icon: 'org' },
  { id: 'goals', label: 'Hedefler', icon: 'target' },
  { id: 'budgets', label: 'Bütçe', icon: 'wallet' },
  { id: 'llm_config', label: 'Yapay Zeka Ayarı', icon: 'cpu' },
  { id: 'integrations', label: 'Bağlantılar', icon: 'link' },
  { id: 'wallpapers', label: 'Duvar Kağıtları', icon: 'sparkles' },
];

const PAGE_ALIASES: Record<string, string> = {
  chat: 'supervisor',
  console: 'dashboard',
  agents: 'office',
  tasks: 'approvals',
  autonomy: 'autonomy_console',
  'llm-config': 'llm_config',
  'tic-products': 'tic_products',
  'tic-orders': 'tic_orders',
  alisveris: 'shopping',
  'commerce-control': 'commerce_control',
  'easy-features': 'dashboard',
  'tum-ozellikler': 'dashboard',
  easy_features: 'dashboard',
};

const ALL_HUB_PAGE_IDS = new Set([
  'dashboard',
  'supervisor',
  'easy_features',
  'tic_products',
  'tic_orders',
  'commerce_control',
  'dashboard_full',
  ...ADVANCED_PAGES.map((p) => p.id),
]);

/** 3 ana bölüm — günlük kullanım. */
export const HUB_SECTIONS: HubSection[] = [
  {
    id: 'home',
    label: 'Ana Sayfa',
    defaultPage: 'dashboard',
    pages: [
      { id: 'dashboard', label: 'Ana Sayfa', icon: 'grid', description: 'Özet ve hızlı işlemler' },
    ],
  },
  {
    id: 'store',
    label: 'Mağaza',
    defaultPage: 'tic_products',
    pages: [
      { id: 'tic_products', label: 'Stok', icon: 'package', description: 'Ürün ve stok seviyeleri' },
      { id: 'tic_orders', label: 'Siparişler', icon: 'bag', description: 'Sipariş takibi' },
      { id: 'commerce_control', label: 'Kontrol', icon: 'shield', description: 'AI mağaza kontrolü' },
    ],
  },
  {
    id: 'assistant',
    label: 'Asistan',
    defaultPage: 'supervisor',
    pages: [
      { id: 'supervisor', label: 'Sohbet', icon: 'zap', description: 'Yapay zeka asistanı' },
    ],
  },
];

const PAGE_DEFS: Record<string, HubPageDef> = {};
for (const sec of HUB_SECTIONS) {
  for (const p of sec.pages) PAGE_DEFS[p.id] = p;
}
for (const p of ADVANCED_PAGES) PAGE_DEFS[p.id] = p;

export function resolveHubPage(pageId: string): string {
  const key = pageId.toLowerCase();
  return PAGE_ALIASES[key] || key;
}

export function getPageDef(pageId: string): HubPageDef | undefined {
  return PAGE_DEFS[resolveHubPage(pageId)];
}

export function getSectionForPage(pageId: string): HubSection {
  const resolved = resolveHubPage(pageId);
  const main = HUB_SECTIONS.find((s) => s.pages.some((p) => p.id === resolved));
  if (main) return main;
  return HUB_SECTIONS[0];
}

export function isAdvancedPage(pageId: string): boolean {
  const resolved = resolveHubPage(pageId);
  return ADVANCED_PAGES.some((p) => p.id === resolved);
}

export function isHubPage(pageId: string): boolean {
  const resolved = resolveHubPage(pageId);
  return ALL_HUB_PAGE_IDS.has(resolved);
}

export function sectionHasSubNav(sectionId: string): boolean {
  const sec = HUB_SECTIONS.find((s) => s.id === sectionId);
  return (sec?.pages.length ?? 0) > 1;
}
