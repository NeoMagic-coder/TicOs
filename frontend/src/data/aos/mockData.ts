// @ts-nocheck
// ============================================================
// AGENT.OS — agent metadata (display-only)
//
// Note: this file used to ship ~330 lines of mock data — sales trends, sample
// chats, hardcoded SKUs, fake audit-event generators, etc. — that the UI
// silently fell back to whenever the real store was empty. Those fallbacks
// have been removed across the app; only the bits that still serve as
// **display metadata** (agent name → glyph/color/layer) plus a thin
// approvals fallback for offline development remain here.
// ============================================================

const AGENTS = [
  { id: 'supervisor',                 name: 'Supervisor',                role: 'Chief of Staff · Orkestratör',     glyph: 'SV', accent: '#9B7BFF', layer: 'orchestrator' },
  { id: 'catalog_agent',              name: 'Catalog',                   role: 'Ürün Kataloğu Yöneticisi',         glyph: 'CT', accent: '#FFB13D', layer: 'core' },
  { id: 'pricing_agent',              name: 'Pricing',                   role: 'Fiyatlandırma Stratejisti',        glyph: 'PR', accent: '#C7FF3D', layer: 'core' },
  { id: 'marketing_agent',            name: 'Marketing',                 role: 'Kampanya & Reklam',                glyph: 'MK', accent: '#FF6BAA', layer: 'core' },
  { id: 'content_seo_agent',          name: 'Content & SEO',             role: 'İçerik Üreticisi & SEO',           glyph: 'CS', accent: '#A78BFA', layer: 'core' },
  { id: 'support_agent',              name: 'Support',                   role: 'Müşteri İletişimi',                glyph: 'SP', accent: '#6BD4FF', layer: 'core' },
  { id: 'operations_agent',           name: 'Operations',                role: 'Operasyon Yöneticisi',             glyph: 'OP', accent: '#F97316', layer: 'core' },
  { id: 'analytics_agent',            name: 'Analytics',                 role: 'Veri Analisti',                    glyph: 'AN', accent: '#3B82F6', layer: 'core' },
  { id: 'compliance_agent',           name: 'Compliance',                role: 'Pazaryeri Uyumluluk',              glyph: 'CO', accent: '#FF5C7A', layer: 'core' },
  { id: 'market_research_agent',      name: 'Market Research',           role: 'Pazar & Rakip Araştırması',        glyph: 'MR', accent: '#22D3EE', layer: 'growth' },
  { id: 'product_development_agent',  name: 'Product Dev',               role: 'Ürün Geliştirme & Tedarik',        glyph: 'PD', accent: '#84CC16', layer: 'growth' },
  { id: 'brand_identity_agent',       name: 'Brand Identity',            role: 'Marka Kimliği',                    glyph: 'BR', accent: '#F472B6', layer: 'growth' },
  { id: 'store_setup_agent',          name: 'Store Setup',               role: 'Mağaza & Kanal Kurulum',           glyph: 'ST', accent: '#EAB308', layer: 'growth' },
  { id: 'email_crm_agent',            name: 'Email & CRM',               role: 'E-posta, SMS, Sadakat',            glyph: 'EM', accent: '#7C3AED', layer: 'growth' },
  { id: 'review_reputation_agent',    name: 'Reviews',                   role: 'Yorum & İtibar',                   glyph: 'RV', accent: '#FBBF24', layer: 'growth' },
  { id: 'growth_agent',               name: 'Growth',                    role: 'Büyüme & Deney',                   glyph: 'GR', accent: '#34D399', layer: 'growth' },
  { id: 'influencer_pr_agent',        name: 'Influencer & PR',           role: 'Influencer & Medya',               glyph: 'IN', accent: '#FB7185', layer: 'growth' },
  { id: 'legal_compliance_agent',     name: 'Legal & Compliance',        role: 'Hukuki Uyum & Sözleşme',           glyph: 'LG', accent: '#94A3B8', layer: 'system' },
  { id: 'negotiation_agent',          name: 'Negotiation',               role: 'Müzakere & Anlaşma',               glyph: 'NG', accent: '#0EA5E9', layer: 'autonomy' },
  { id: 'logistics_agent',            name: 'Logistics',                 role: 'Lojistik Koordinasyon',            glyph: 'LO', accent: '#14B8A6', layer: 'autonomy' },
  { id: 'dynamic_pricing_agent',      name: 'Dynamic Pricing',           role: 'Dinamik Fiyatlandırma',            glyph: 'DP', accent: '#F59E0B', layer: 'autonomy' },
  { id: 'autonomous_decision_agent',  name: 'Autonomous Decision',       role: 'Otonom Karar Koordinatörü',        glyph: 'AD', accent: '#A855F7', layer: 'autonomy' },
];

const LAYER_LABELS = {
  orchestrator: 'Orkestratör',
  core: 'Çekirdek Ajanlar',
  growth: 'Büyüme & Marka',
  system: 'Sistem',
  autonomy: 'Otonomi Katmanı',
};

const AGENT_BY_ID = Object.fromEntries(AGENTS.map((a) => [a.id, a]));

// Minimal export surface — anything else used to live here was demo seed data
// and has been removed. The Approvals page now renders a real empty state
// instead of a "demo" card when the store is cold.
export { AGENTS, AGENT_BY_ID, LAYER_LABELS };

// `TOOLS` shim — only ToolsPage still imports this as a fallback. We keep an
// empty array so the import works but the UI renders its empty state instead
// of an out-of-date manifest snapshot.
export const TOOLS: any[] = [];
