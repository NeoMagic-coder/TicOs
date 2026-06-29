import type { OnboardedProduct } from '@/types';

export interface StageOption {
  value: OnboardedProduct['stage'];
  code: string;
  label: string;
  hint: string;
  icon: string;
  lights: string[];
}

export const STAGES: StageOption[] = [
  { value: 'idea',              code: 'IDEA',          label: 'Sıfırdan, fikir aşaması',           hint: 'Ürün yok · araştırmadan başla', icon: 'IcBulb',      lights: ['Research', 'Brand', 'Pricing'] },
  { value: 'product_no_store',  code: 'PRODUCT',       label: 'Ürünüm var, mağaza yok',            hint: 'Marka + Shopify/pazaryeri',     icon: 'IcPackage',   lights: ['Brand', 'Listing', 'Storefront'] },
  { value: 'store_growing',     code: 'GROWING',       label: 'Mağazam var, büyümek istiyorum',    hint: 'Reklam · CRO · email · kanal',  icon: 'IcRocket',    lights: ['Ads-Meta', 'Ads-Google', 'CRO', 'Email'] },
  { value: 'marketplace_opt',   code: 'MARKETPLACE',   label: 'Pazaryerindeyim, optimize ediyorum', hint: 'Listing · fiyat · yorum',       icon: 'IcCrosshair', lights: ['Pricing', 'Review', 'Listing'] },
];

export interface MarketOption {
  value: OnboardedProduct['target_market'];
  code: string;
  label: string;
  icon: string;
  desc: string;
}

export const MARKETS: MarketOption[] = [
  { value: 'TR',     code: 'TR',     label: 'Türkiye',  icon: 'IcGlobeTR',    desc: 'Trendyol · Hepsiburada · Shopify TR' },
  { value: 'GLOBAL', code: 'GLOBAL', label: 'Global',   icon: 'IcGlobeWorld', desc: 'Shopify · Amazon · Etsy · TikTok' },
  { value: 'BOTH',   code: 'DUAL',   label: 'İkisi de', icon: 'IcGlobeBoth',  desc: 'TR + Global çoklu kanal' },
];

export interface ChannelOption {
  id: string;
  region: 'TR' | 'GLOBAL' | 'BOTH';
}

export const CHANNELS: ChannelOption[] = [
  { id: 'Shopify',       region: 'BOTH'   },
  { id: 'WooCommerce',   region: 'BOTH'   },
  { id: 'Trendyol',      region: 'TR'     },
  { id: 'Hepsiburada',   region: 'TR'     },
  { id: 'Amazon TR',     region: 'TR'     },
  { id: 'Amazon Global', region: 'GLOBAL' },
  { id: 'Etsy',          region: 'GLOBAL' },
  { id: 'TikTok Shop',   region: 'BOTH'   },
  { id: 'Sahibinden',    region: 'TR'     },
  { id: 'Dolap',         region: 'TR'     },
];

export const CATEGORIES = [
  'Ev & Mutfak', 'Moda & Aksesuar', 'Elektronik', 'Kozmetik & Bakım',
  'Spor & Outdoor', 'Bebek & Anne', 'Hobi', 'Otomotiv',
];

export interface BudgetOption {
  id: OnboardedProduct['monthly_budget_band'];
  code: string;
  label: string;
  range: string;
  desc: string;
  icon: string;
  watts: string;
}

export const BUDGETS: BudgetOption[] = [
  { id: '0-5k',     code: 'MICRO',  label: '< 5K ₺',     range: '/ay', desc: 'mikro testler · organik',       icon: 'IcTierMicro',  watts: '12W'  },
  { id: '5k-25k',   code: 'SMALL',  label: '5–25K ₺',    range: '/ay', desc: 'küçük kampanya · ilk ölçüm',    icon: 'IcTierSmall',  watts: '48W'  },
  { id: '25k-100k', code: 'GROWTH', label: '25–100K ₺',  range: '/ay', desc: 'büyüme · çoklu kanal',          icon: 'IcTierGrowth', watts: '180W' },
  { id: '100k+',    code: 'SCALE',  label: '100K+ ₺',    range: '/ay', desc: 'ölçek · A/B havuzu',            icon: 'IcTierScale',  watts: '750W' },
];

export type PriorityAccent = 'amber' | 'violet' | 'cyan' | 'acid';

export interface PriorityOption {
  id: string;
  code: string;
  label: string;
  desc: string;
  icon: string;
  accent: PriorityAccent;
}

export const PRIORITIES: PriorityOption[] = [
  { id: 'fast_sales',     code: 'SPEED',  label: 'Hızlı satış',    desc: 'ilk 30 günde sipariş açmak',     icon: 'IcBolt',    accent: 'amber'  },
  { id: 'brand_building', code: 'BRAND',  label: 'Marka kurmak',   desc: 'hikaye · ton · görsel sistem',   icon: 'IcSparkle', accent: 'violet' },
  { id: 'cost_reduction', code: 'COST',   label: 'Maliyet düşür',  desc: 'birim ekonomi · stok · iade',    icon: 'IcCoin',    accent: 'cyan'   },
  { id: 'scaling',        code: 'SCALE',  label: 'Ölçeklenmek',    desc: 'reklam + kanal + otomasyon',     icon: 'IcGrowth',  accent: 'acid'   },
];

export type FleetGroup = 'CORE' | 'OPS' | 'GROWTH' | 'INTEL';
export type FleetActivator = 'product_name' | 'category' | 'stage' | 'target_market' | 'channels' | 'priorities';

export interface FleetAgent {
  id: string;
  name: string;
  group: FleetGroup;
  activates: FleetActivator[];
}

/* 22 agents grouped by domain. */
export const FLEET: FleetAgent[] = [
  { id: 'ceo',         name: 'CEO Agent',         group: 'CORE',   activates: ['product_name'] },
  { id: 'brand',       name: 'Brand Agent',       group: 'CORE',   activates: ['product_name', 'category'] },
  { id: 'research',    name: 'Research Agent',    group: 'CORE',   activates: ['product_name', 'category'] },
  { id: 'pricing',     name: 'Pricing Agent',     group: 'CORE',   activates: ['product_name'] },

  { id: 'listing',     name: 'Listing Agent',     group: 'OPS',    activates: ['stage'] },
  { id: 'storefront',  name: 'Storefront Agent',  group: 'OPS',    activates: ['stage'] },
  { id: 'inventory',   name: 'Inventory Agent',   group: 'OPS',    activates: ['stage'] },
  { id: 'supplier',    name: 'Supplier Agent',    group: 'OPS',    activates: ['stage'] },
  { id: 'logistics',   name: 'Logistics Agent',   group: 'OPS',    activates: ['stage'] },

  { id: 'ads-meta',    name: 'Ads — Meta',        group: 'GROWTH', activates: ['channels'] },
  { id: 'ads-google',  name: 'Ads — Google',      group: 'GROWTH', activates: ['channels'] },
  { id: 'ads-tiktok',  name: 'Ads — TikTok',      group: 'GROWTH', activates: ['channels'] },
  { id: 'seo',         name: 'SEO Agent',         group: 'GROWTH', activates: ['target_market'] },
  { id: 'email',       name: 'Email Agent',       group: 'GROWTH', activates: ['target_market'] },
  { id: 'cro',         name: 'CRO Agent',         group: 'GROWTH', activates: ['channels'] },
  { id: 'content',     name: 'Content Agent',     group: 'GROWTH', activates: ['target_market'] },
  { id: 'influencer',  name: 'Influencer Agent',  group: 'GROWTH', activates: ['channels'] },

  { id: 'review',      name: 'Review Agent',      group: 'INTEL',  activates: ['priorities'] },
  { id: 'support',     name: 'Support Agent',     group: 'INTEL',  activates: ['priorities'] },
  { id: 'analytics',   name: 'Analytics Agent',   group: 'INTEL',  activates: ['priorities'] },
  { id: 'forecast',    name: 'Forecast Agent',    group: 'INTEL',  activates: ['priorities'] },
  { id: 'compliance',  name: 'Compliance Agent',  group: 'INTEL',  activates: ['priorities'] },
];

export interface PhaseDef {
  n: number;
  code: string;
  title: string;
  subtitle: string;
}

export const PHASES: PhaseDef[] = [
  { n: 1, code: 'PRODUCT',     title: 'Define product',     subtitle: 'Çekirdek profili çiz' },
  { n: 2, code: 'MARKET',      title: 'Configure market',   subtitle: 'Pazar · kanal · bütçe' },
  { n: 3, code: 'DIRECTIVES',  title: 'Set directives',     subtitle: 'Hedefleri sırala' },
  { n: 4, code: 'INITIALIZE',  title: 'Initialize fleet',   subtitle: 'Boot sequence' },
];

export interface BootLine { t: number; line: string; }

export function bootLines(
  draft: Partial<OnboardedProduct>,
  agentCount: number,
  toolCount: number,
): BootLine[] {
  const channels = draft.channels || [];
  return [
    { t: 0,    line: `[ os ] init ticosclaw.v1 ... ok` },
    { t: 120,  line: `[ os ] loading profile :: ${draft.product_name || 'untitled'}` },
    { t: 240,  line: `[ ceo ] generating roadmap ...` },
    { t: 380,  line: `[ ceo ] roadmap.q1 ready (4 milestones)` },
    { t: 500,  line: `[brand] drafting identity from "${(draft.product_description || draft.product_name || '').slice(0, 32)}..."` },
    { t: 680,  line: `[brand] palette + tone-of-voice committed` },
    { t: 800,  line: `[ rsr ] scanning niche · ${draft.category || '—'} ...` },
    { t: 980,  line: `[ rsr ] 12 competitors mapped · 4 gaps found` },
    { t: 1120, line: `[price] unit economics solver ... ok` },
    { t: 1280, line: `[ ads ] arming ${channels.length} channels :: ${channels.slice(0, 3).join(' · ') || 'none'}` },
    { t: 1440, line: `[ fleet ] ${agentCount}/${agentCount} agents armed · ${toolCount} tools registered` },
    { t: 1600, line: `[ os ] ready. press [launch] to commit.` },
  ];
}
