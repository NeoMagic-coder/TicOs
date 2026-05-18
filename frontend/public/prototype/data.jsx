/* global React */
// ============================================================
// AGENT.OS — mock data
// Modeled after real OneProduct-Agent-OS repo (apps/agents.ts,
// tools manifests, autonomy layer).
// ============================================================

const AGENTS = [
  { id: 'supervisor',                 name: 'Supervisor',                role: 'Chief of Staff · Orkestratör',     glyph: 'SV', accent: '#9B7BFF', layer: 'orchestrator',  status: 'busy',    pid: 'A01', tools: 8,  conf: 0.94, tasks: 17, load: 64, lastTool: 'task_assign' },
  { id: 'catalog_agent',              name: 'Catalog',                   role: 'Ürün Kataloğu Yöneticisi',         glyph: 'CT', accent: '#FFB13D', layer: 'core',          status: 'running', pid: 'A02', tools: 14, conf: 0.88, tasks: 42, load: 81, lastTool: 'shopify_update_product' },
  { id: 'pricing_agent',              name: 'Pricing',                   role: 'Fiyatlandırma Stratejisti',        glyph: 'PR', accent: '#C7FF3D', layer: 'core',          status: 'running', pid: 'A03', tools: 9,  conf: 0.91, tasks: 28, load: 54, lastTool: 'competitor_price_lookup' },
  { id: 'marketing_agent',            name: 'Marketing',                 role: 'Kampanya & Reklam',                glyph: 'MK', accent: '#FF6BAA', layer: 'core',          status: 'running', pid: 'A04', tools: 11, conf: 0.86, tasks: 19, load: 47, lastTool: 'meta_ads_create_draft' },
  { id: 'content_seo_agent',          name: 'Content & SEO',             role: 'İçerik Üreticisi & SEO',           glyph: 'CS', accent: '#A78BFA', layer: 'core',          status: 'busy',    pid: 'A05', tools: 12, conf: 0.83, tasks: 36, load: 38, lastTool: 'content_generator' },
  { id: 'support_agent',              name: 'Support',                   role: 'Müşteri İletişimi',                glyph: 'SP', accent: '#6BD4FF', layer: 'core',          status: 'idle',    pid: 'A06', tools: 11, conf: 0.79, tasks: 88, load: 12, lastTool: 'draft_reply_generator' },
  { id: 'operations_agent',           name: 'Operations',                role: 'Operasyon Yöneticisi',             glyph: 'OP', accent: '#F97316', layer: 'core',          status: 'running', pid: 'A07', tools: 11, conf: 0.92, tasks: 51, load: 67, lastTool: 'stock_forecast' },
  { id: 'analytics_agent',            name: 'Analytics',                 role: 'Veri Analisti',                    glyph: 'AN', accent: '#3B82F6', layer: 'core',          status: 'running', pid: 'A08', tools: 14, conf: 0.90, tasks: 24, load: 73, lastTool: 'analytics_channel_perf' },
  { id: 'compliance_agent',           name: 'Compliance',                role: 'Pazaryeri Uyumluluk',              glyph: 'CO', accent: '#FF5C7A', layer: 'core',          status: 'idle',    pid: 'A09', tools: 7,  conf: 0.95, tasks: 14, load: 4,  lastTool: 'listing_compliance_check' },
  { id: 'market_research_agent',      name: 'Market Research',           role: 'Pazar & Rakip Araştırması',        glyph: 'MR', accent: '#22D3EE', layer: 'growth',        status: 'busy',    pid: 'A10', tools: 11, conf: 0.81, tasks: 9,  load: 44, lastTool: 'amazon_bestseller_scrape' },
  { id: 'product_development_agent',  name: 'Product Dev',               role: 'Ürün Geliştirme & Tedarik',        glyph: 'PD', accent: '#84CC16', layer: 'growth',        status: 'idle',    pid: 'A11', tools: 6,  conf: 0.88, tasks: 5,  load: 0,  lastTool: 'alibaba_supplier_search' },
  { id: 'brand_identity_agent',       name: 'Brand Identity',            role: 'Marka Kimliği',                    glyph: 'BR', accent: '#F472B6', layer: 'growth',        status: 'idle',    pid: 'A12', tools: 7,  conf: 0.85, tasks: 7,  load: 0,  lastTool: 'color_palette_generator' },
  { id: 'store_setup_agent',          name: 'Store Setup',               role: 'Mağaza & Kanal Kurulum',           glyph: 'ST', accent: '#EAB308', layer: 'growth',        status: 'idle',    pid: 'A13', tools: 5,  conf: 0.93, tasks: 3,  load: 0,  lastTool: 'shopify_store_create' },
  { id: 'email_crm_agent',            name: 'Email & CRM',               role: 'E-posta, SMS, Sadakat',            glyph: 'EM', accent: '#7C3AED', layer: 'growth',        status: 'running', pid: 'A14', tools: 6,  conf: 0.87, tasks: 22, load: 31, lastTool: 'email_sequence_writer' },
  { id: 'review_reputation_agent',    name: 'Reviews',                   role: 'Yorum & İtibar',                   glyph: 'RV', accent: '#FBBF24', layer: 'growth',        status: 'busy',    pid: 'A15', tools: 6,  conf: 0.84, tasks: 47, load: 56, lastTool: 'review_sentiment_analyzer' },
  { id: 'growth_agent',               name: 'Growth',                    role: 'Büyüme & Deney',                   glyph: 'GR', accent: '#34D399', layer: 'growth',        status: 'idle',    pid: 'A16', tools: 7,  conf: 0.82, tasks: 11, load: 6,  lastTool: 'ab_test_designer' },
  { id: 'influencer_pr_agent',        name: 'Influencer & PR',           role: 'Influencer & Medya',               glyph: 'IN', accent: '#FB7185', layer: 'growth',        status: 'idle',    pid: 'A17', tools: 6,  conf: 0.86, tasks: 4,  load: 0,  lastTool: 'influencer_discovery' },
  { id: 'legal_compliance_agent',     name: 'Legal & Compliance',        role: 'Hukuki Uyum & Sözleşme',           glyph: 'LG', accent: '#94A3B8', layer: 'system',        status: 'idle',    pid: 'A18', tools: 6,  conf: 0.96, tasks: 6,  load: 0,  lastTool: 'kvkk_compliance_checker' },
  { id: 'negotiation_agent',          name: 'Negotiation',               role: 'Müzakere & Anlaşma',               glyph: 'NG', accent: '#0EA5E9', layer: 'autonomy',      status: 'busy',    pid: 'A19', tools: 5,  conf: 0.78, tasks: 3,  load: 49, lastTool: 'counter_offer_generator' },
  { id: 'logistics_agent',            name: 'Logistics',                 role: 'Lojistik Koordinasyon',            glyph: 'LO', accent: '#14B8A6', layer: 'autonomy',      status: 'running', pid: 'A20', tools: 5,  conf: 0.89, tasks: 15, load: 42, lastTool: 'carrier_rate_comparator' },
  { id: 'dynamic_pricing_agent',      name: 'Dynamic Pricing',           role: 'Dinamik Fiyatlandırma',            glyph: 'DP', accent: '#F59E0B', layer: 'autonomy',      status: 'running', pid: 'A21', tools: 5,  conf: 0.91, tasks: 33, load: 71, lastTool: 'dynamic_price_engine' },
  { id: 'autonomous_decision_agent',  name: 'Autonomous Decision',       role: 'Otonom Karar Koordinatörü',        glyph: 'AD', accent: '#A855F7', layer: 'autonomy',      status: 'busy',    pid: 'A22', tools: 3,  conf: 0.93, tasks: 18, load: 58, lastTool: 'autonomy_policy_check' },
];

const LAYER_LABELS = {
  orchestrator: 'Orkestratör',
  core: 'Çekirdek Ajanlar',
  growth: 'Büyüme & Marka',
  system: 'Sistem',
  autonomy: 'Otonomi Katmanı',
};

const AGENT_BY_ID = Object.fromEntries(AGENTS.map(a => [a.id, a]));

// ============================================================
// Tools — slice of the 76-tool registry
// ============================================================
const TOOLS = [
  { id: 'shopify_get_products',        name: 'Shopify Ürünleri Getir',     category: 'catalog',         provider: 'shopify',   mode: 'live', calls: 312, ms: 412, success: 99.4, cost: 0.001, tags: ['shopify','catalog','products'] },
  { id: 'shopify_update_product',      name: 'Shopify Ürün Güncelle',      category: 'catalog',         provider: 'shopify',   mode: 'live', calls: 87,  ms: 524, success: 98.8, cost: 0.001, tags: ['shopify','catalog','write'] },
  { id: 'shopify_update_inventory',    name: 'Shopify Stok Güncelle',      category: 'stock',           provider: 'shopify',   mode: 'live', calls: 144, ms: 388, success: 99.1, cost: 0.001, tags: ['shopify','stock','write'] },
  { id: 'trendyol_get_products',       name: 'Trendyol Ürünleri Listele',  category: 'catalog',         provider: 'trendyol',  mode: 'live', calls: 218, ms: 514, success: 97.8, cost: 0.001, tags: ['trendyol','marketplace'] },
  { id: 'trendyol_update_price',       name: 'Trendyol Fiyat Güncelle',    category: 'pricing',         provider: 'trendyol',  mode: 'live', calls: 76,  ms: 612, success: 98.4, cost: 0.001, tags: ['trendyol','pricing','write'] },
  { id: 'trendyol_get_orders',         name: 'Trendyol Sipariş Çek',       category: 'order',           provider: 'trendyol',  mode: 'live', calls: 198, ms: 488, success: 98.0, cost: 0.001, tags: ['trendyol','orders'] },
  { id: 'ga4_realtime_report',         name: 'GA4 Realtime Raporu',        category: 'analytics',       provider: 'google',    mode: 'live', calls: 84,  ms: 1124, success: 96.9, cost: 0.002, tags: ['analytics','ga4'] },
  { id: 'ga4_sessions_report',         name: 'GA4 Seans Raporu',           category: 'analytics',       provider: 'google',    mode: 'live', calls: 67,  ms: 982, success: 97.2, cost: 0.002, tags: ['analytics','ga4'] },
  { id: 'brand_visual_generator',      name: 'Marka Görseli Üret',         category: 'brand',           provider: 'gemini',    mode: 'live', calls: 32,  ms: 20180, success: 100.0, cost: 0.039, tags: ['brand','image','gemini'] },
  { id: 'memory_search',               name: 'Bellek Araması (pgvector)',  category: 'memory',          provider: 'internal',  mode: 'live', calls: 451, ms: 142, success: 99.8, cost: 0.0005, tags: ['memory','rag','vector'] },
  { id: 'knowledge_search',            name: 'Bilgi Tabanı Araması',       category: 'knowledge',       provider: 'internal',  mode: 'live', calls: 612, ms: 168, success: 99.5, cost: 0.0005, tags: ['knowledge','rag'] },
  { id: 'meta_ads_get_campaigns',      name: 'Meta Ads Kampanyaları',      category: 'marketing',       provider: 'meta',      mode: 'mock', calls: 41,  ms: 740, success: 100,  cost: 0.001, tags: ['meta','ads'] },
  { id: 'meta_ads_create_draft',       name: 'Meta Ads Taslak Oluştur',    category: 'marketing',       provider: 'meta',      mode: 'mock', calls: 22,  ms: 980, success: 100,  cost: 0.001, tags: ['meta','ads','write'] },
  { id: 'google_ads_get_campaigns',    name: 'Google Ads Kampanyaları',    category: 'marketing',       provider: 'google',    mode: 'mock', calls: 28,  ms: 820, success: 100,  cost: 0.001, tags: ['google','ads'] },
  { id: 'competitor_price_lookup',     name: 'Rakip Fiyat Sorgula',        category: 'pricing',         provider: 'internal',  mode: 'mock', calls: 187, ms: 254, success: 99.5, cost: 0.0008, tags: ['pricing','competitor'] },
  { id: 'margin_calculator',           name: 'Marj Hesaplayıcı',           category: 'pricing',         provider: 'internal',  mode: 'mock', calls: 96,  ms: 12,  success: 100,  cost: 0.0,   tags: ['pricing','calc'] },
  { id: 'dynamic_price_engine',        name: 'Dinamik Fiyat Motoru',       category: 'dynamic_pricing', provider: 'internal',  mode: 'mock', calls: 71,  ms: 320, success: 98.6, cost: 0.001, tags: ['pricing','dynamic'] },
  { id: 'stock_forecast',              name: 'Stok Tahmini',               category: 'stock',           provider: 'internal',  mode: 'mock', calls: 54,  ms: 480, success: 100,  cost: 0.0008, tags: ['stock','forecast'] },
  { id: 'stock_levels_query',          name: 'Stok Seviyeleri',            category: 'stock',           provider: 'internal',  mode: 'mock', calls: 132, ms: 84,  success: 100,  cost: 0.0,   tags: ['stock'] },
  { id: 'review_aggregator',           name: 'Yorum Toplayıcı',            category: 'review',          provider: 'internal',  mode: 'mock', calls: 88,  ms: 612, success: 99.0, cost: 0.0008, tags: ['review'] },
  { id: 'review_sentiment_analyzer',   name: 'Yorum Duygu Analizi',        category: 'review',          provider: 'internal',  mode: 'mock', calls: 76,  ms: 412, success: 98.8, cost: 0.001, tags: ['review','nlp'] },
  { id: 'review_response_generator',   name: 'Yorum Yanıt Üretici',        category: 'review',          provider: 'internal',  mode: 'mock', calls: 41,  ms: 1420, success: 99.5, cost: 0.002, tags: ['review','llm'] },
  { id: 'content_generator',           name: 'İçerik Üretici',             category: 'content_seo',     provider: 'internal',  mode: 'mock', calls: 122, ms: 2840, success: 99.2, cost: 0.003, tags: ['content','llm'] },
  { id: 'email_sequence_writer',       name: 'E-posta Akışı Yazıcı',       category: 'email',           provider: 'internal',  mode: 'mock', calls: 36,  ms: 3120, success: 100,  cost: 0.003, tags: ['email','llm'] },
  { id: 'carrier_rate_comparator',     name: 'Kargo Fiyat Karşılaştırıcı', category: 'logistics',       provider: 'internal',  mode: 'mock', calls: 49,  ms: 480, success: 99.6, cost: 0.001, tags: ['logistics','carrier'] },
  { id: 'autonomy_policy_check',       name: 'Otonomi Politika Kontrolü',  category: 'decision',        provider: 'internal',  mode: 'mock', calls: 188, ms: 8,   success: 100,  cost: 0.0,   tags: ['autonomy','policy'] },
  { id: 'counter_offer_generator',     name: 'Karşı Teklif Üretici',       category: 'negotiation',     provider: 'internal',  mode: 'mock', calls: 22,  ms: 1820, success: 100,  cost: 0.002, tags: ['negotiation','llm'] },
  { id: 'amazon_bestseller_scrape',    name: 'Amazon Bestseller Tarama',   category: 'research',        provider: 'internal',  mode: 'mock', calls: 33,  ms: 2240, success: 96.5, cost: 0.002, tags: ['research','scrape'] },
  { id: 'kvkk_compliance_checker',     name: 'KVKK Uyum Kontrolü',         category: 'legal',           provider: 'internal',  mode: 'mock', calls: 17,  ms: 220, success: 100,  cost: 0.0,   tags: ['legal','kvkk'] },
  { id: 'cogs_calculator',             name: 'COGS Hesaplayıcı',           category: 'product',         provider: 'internal',  mode: 'mock', calls: 24,  ms: 6,   success: 100,  cost: 0.0,   tags: ['product','calc'] },
];

const TOOL_CATEGORIES = [
  { id: 'all',             label: 'Tümü',             count: 76 },
  { id: 'catalog',         label: 'catalog',          count: 9 },
  { id: 'pricing',         label: 'pricing',          count: 8 },
  { id: 'marketing',       label: 'marketing',        count: 9 },
  { id: 'analytics',       label: 'analytics',        count: 7 },
  { id: 'order',           label: 'order',            count: 5 },
  { id: 'stock',           label: 'stock',            count: 5 },
  { id: 'review',          label: 'review',           count: 4 },
  { id: 'support',         label: 'support',          count: 6 },
  { id: 'content_seo',     label: 'content_seo',      count: 5 },
  { id: 'compliance',      label: 'compliance',       count: 4 },
  { id: 'brand',           label: 'brand',            count: 4 },
  { id: 'logistics',       label: 'logistics',        count: 3 },
  { id: 'dynamic_pricing', label: 'dynamic_pricing',  count: 3 },
  { id: 'negotiation',     label: 'negotiation',      count: 3 },
  { id: 'decision',        label: 'decision',         count: 3 },
  { id: 'memory',          label: 'memory',           count: 2 },
];

// ============================================================
// Approvals — autonomy policy decisions
// ============================================================
const APPROVALS = [
  {
    id: 'apv_8c3f',
    type: 'price_change',
    title: 'Fiyat değişikliği önerisi: 219 ₺ → 239 ₺',
    sku: 'OP-CRM-50ML',
    risk: 'medium',
    riskPct: 0.62,
    confidence: 0.87,
    requester: 'dynamic_pricing_agent',
    delta: '+%9.1',
    rationale: 'Son 7 gün rakip ortalaması 234 ₺ — %4 altında konumlanıyoruz. Stok 47 gün, talep stabil.',
    impact: { marj: '+3.4 puan', dönüşüm: '-%1.1', gelir: '+₺8,420 / hafta' },
    policy: { auto_threshold: '%5', this_action: '%9.1', breach: true },
    tools: ['competitor_price_lookup', 'margin_calculator', 'dynamic_price_engine'],
    createdAt: '14:21:03',
  },
  {
    id: 'apv_3d12',
    type: 'budget_increase',
    title: 'Meta Ads bütçe artışı: 250 ₺/gün → 400 ₺/gün',
    sku: 'campaign_meta_main',
    risk: 'low',
    riskPct: 0.28,
    confidence: 0.91,
    requester: 'marketing_agent',
    delta: '+%60',
    rationale: 'Son 7 gün ROAS 3.8x · CTR yükseliyor · CPM düştü. Bütçe artışı için tüm sinyaller pozitif.',
    impact: { gelir: '+%60 (₺/gün)', ROAS: 'hedef 3.2x', risk: 'düşük' },
    policy: { auto_threshold: '50% / ROAS>3', this_action: 'within', breach: false },
    tools: ['meta_ads_get_campaigns', 'campaign_roas_report'],
    createdAt: '13:52:41',
  },
  {
    id: 'apv_a91b',
    type: 'reorder',
    title: 'Acil reorder: OP-CRM-50ML',
    sku: 'OP-CRM-50ML',
    risk: 'high',
    riskPct: 0.81,
    confidence: 0.96,
    requester: 'operations_agent',
    delta: '400 adet',
    rationale: 'Mevcut hızda 12 gün içinde tükeniyor. Lead time 14 gün. Tedarikçi onayı bekliyor.',
    impact: { stok: '+400 adet', maliyet: '₺36,800', stockout_risk: 'yüksek' },
    policy: { auto_threshold: '₺20k', this_action: '₺36.8k', breach: true },
    tools: ['stock_forecast', 'cogs_calculator', 'order_list'],
    createdAt: '12:08:11',
  },
  {
    id: 'apv_5f24',
    type: 'carrier_switch',
    title: 'Kargo değişimi: Yurtiçi → Aras (1,420 ₺/hafta tasarruf)',
    sku: 'fulfillment_default',
    risk: 'low',
    riskPct: 0.15,
    confidence: 0.93,
    requester: 'logistics_agent',
    delta: '-₺1,420/hafta',
    rationale: 'Aras son 30 gün ortalama teslim süresi 1.6 gün, müşteri memnuniyeti 4.7/5. Maliyet %18 düşük.',
    impact: { maliyet: '-%18', süre: '-0.4 gün', cs_score: '+0.3' },
    policy: { auto_threshold: '₺500', this_action: '₺1,420', breach: true },
    tools: ['carrier_rate_comparator', 'shipment_tracking_aggregator'],
    createdAt: '11:34:55',
  },
  {
    id: 'apv_2b78',
    type: 'public_response',
    title: 'Düşük puanlı yoruma genel yanıt',
    sku: 'review_trendyol_8841',
    risk: 'medium',
    riskPct: 0.45,
    confidence: 0.79,
    requester: 'review_reputation_agent',
    delta: 'public',
    rationale: 'Müşteri 2 yıldız verdi, "ambalaj zarar görmüş" şikayeti. Empati + iade önerisi içeren taslak hazır.',
    impact: { reach: '~2,400 görüntülenme', tone: 'empatik' },
    policy: { auto_threshold: 'private only', this_action: 'public', breach: true },
    tools: ['review_response_generator', 'brand_tone_checker'],
    createdAt: '10:17:42',
  },
];

// ============================================================
// Scheduled jobs / cron
// ============================================================
const SCHEDULED = [
  { name: 'reviews.daily_sweep',   cron: "cron[hour='18', minute='0']",     next: '16.05.2026 18:00:00', owner: 'review_reputation_agent', last: 'ok', dur: '14.2s' },
  { name: 'pricing.daily_review',  cron: "cron[hour='9', minute='0']",      next: '17.05.2026 09:00:00', owner: 'pricing_agent',           last: 'ok', dur: '38.7s' },
  { name: 'ops.hourly_sweep',      cron: "interval[1:00:00]",                next: '16.05.2026 17:00:00', owner: 'operations_agent',        last: 'ok', dur: '4.1s'  },
  { name: 'memory.consolidation',  cron: "cron[hour='3', minute='0']",      next: '17.05.2026 03:00:00', owner: 'autonomous_decision_agent',last: 'ok', dur: '92.4s' },
  { name: 'ga4.realtime_pulse',    cron: "interval[0:05:00]",                next: '16.05.2026 16:55:00', owner: 'analytics_agent',         last: 'ok', dur: '1.8s'  },
  { name: 'compliance.weekly',     cron: "cron[day_of_week='1', hour='8']", next: '18.05.2026 08:00:00', owner: 'compliance_agent',        last: 'ok', dur: '24.6s' },
];

// ============================================================
// Live audit/event stream — terminal-style log lines
// ============================================================
const EVENT_TEMPLATES = [
  { t: 'hermes.task.created',        agent: 'supervisor',             level: 'info',   msg: 'task_id={tid} priority=high' },
  { t: 'hermes.plan.ready',          agent: 'supervisor',             level: 'info',   msg: 'primary={agent} supporting=[{sup}] nodes={n}' },
  { t: 'openclaw.tool.invoke',       agent: '{agent}',                level: 'info',   msg: 'tool={tool} args=ok cost=${cost}' },
  { t: 'openclaw.tool.success',      agent: '{agent}',                level: 'info',   msg: 'tool={tool} duration={ms}ms' },
  { t: 'critic.scored',              agent: 'critic',                 level: 'info',   msg: 'agent={agent} concreteness={c1} numeric={c2} halluc={c3}' },
  { t: 'autonomy.policy.check',      agent: 'autonomous_decision_agent', level: 'info', msg: 'action={action} risk={risk} threshold={thr}' },
  { t: 'autonomy.auto_approved',     agent: 'autonomous_decision_agent', level: 'ok',  msg: 'action={action} reason=below_threshold' },
  { t: 'autonomy.needs_approval',    agent: 'autonomous_decision_agent', level: 'warn',msg: 'action={action} reason=policy_breach' },
  { t: 'openclaw.breaker.degraded',  agent: 'openclaw',               level: 'warn',   msg: 'tool={tool} circuit=open → fallback=mock' },
  { t: 'hermes.merge.complete',      agent: 'supervisor',             level: 'ok',     msg: 'confidence={c} tools_used={tu}' },
  { t: 'memory.write',               agent: '{agent}',                level: 'info',   msg: 'kind=fact vector_id={vid}' },
];

const EVENT_AGENTS = ['catalog_agent','pricing_agent','marketing_agent','analytics_agent','operations_agent','dynamic_pricing_agent','content_seo_agent','review_reputation_agent','logistics_agent'];
const EVENT_TOOLS  = ['shopify_get_products','trendyol_update_price','competitor_price_lookup','meta_ads_get_campaigns','ga4_realtime_report','stock_forecast','dynamic_price_engine','review_sentiment_analyzer','knowledge_search','memory_search','content_generator','carrier_rate_comparator','autonomy_policy_check'];

function randId(prefix='') { return prefix + Math.random().toString(36).slice(2, 7); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function makeEvent(now = new Date()) {
  const tpl = pick(EVENT_TEMPLATES);
  const agent = tpl.agent.includes('{') ? pick(EVENT_AGENTS) : tpl.agent;
  const tool = pick(EVENT_TOOLS);
  const msg = tpl.msg
    .replaceAll('{tid}',    randId('t_'))
    .replaceAll('{agent}',  agent)
    .replaceAll('{sup}',    pick(EVENT_AGENTS) + ',' + pick(EVENT_AGENTS))
    .replaceAll('{n}',      String(3 + Math.floor(Math.random()*4)))
    .replaceAll('{tool}',   tool)
    .replaceAll('{cost}',   (Math.random()*0.005).toFixed(4))
    .replaceAll('{ms}',     String(40 + Math.floor(Math.random() * 1800)))
    .replaceAll('{c1}',     (0.7 + Math.random()*0.3).toFixed(2))
    .replaceAll('{c2}',     (0.7 + Math.random()*0.3).toFixed(2))
    .replaceAll('{c3}',     (Math.random()*0.2).toFixed(2))
    .replaceAll('{c}',      (0.75 + Math.random()*0.22).toFixed(2))
    .replaceAll('{tu}',     String(2 + Math.floor(Math.random()*7)))
    .replaceAll('{action}', pick(['price_change_+%4.8','carrier_switch_500₺','reorder_120u','public_response','draft_email_send']))
    .replaceAll('{risk}',   pick(['low','medium','high']))
    .replaceAll('{thr}',    pick(['%5','%10','₺500','₺1000']))
    .replaceAll('{vid}',    randId('v_'));
  return {
    id: randId('e_'),
    ts: now.toLocaleTimeString('tr-TR', {hour12: false}) + '.' + String(now.getMilliseconds()).padStart(3,'0'),
    event: tpl.t,
    agent,
    level: tpl.level,
    msg,
  };
}

// 60 seed events for the audit log
const SEED_EVENTS = (() => {
  const arr = [];
  const now = Date.now();
  for (let i = 60; i > 0; i--) {
    arr.push(makeEvent(new Date(now - i * 2400)));
  }
  return arr;
})();

// ============================================================
// 7-day sales trend
// ============================================================
const SALES_TREND = [
  { day: '10 May', sales: 8420,  orders: 47,  roas: 3.1 },
  { day: '11 May', sales: 9180,  orders: 52,  roas: 3.4 },
  { day: '12 May', sales: 7950,  orders: 44,  roas: 2.9 },
  { day: '13 May', sales: 11240, orders: 63,  roas: 3.7 },
  { day: '14 May', sales: 12480, orders: 71,  roas: 3.9 },
  { day: '15 May', sales: 10940, orders: 58,  roas: 3.5 },
  { day: '16 May', sales: 13620, orders: 78,  roas: 4.2 },
];

const CHANNELS = [
  { name: 'Shopify',     sales: 38420, orders: 214, share: 0.42, color: '#95BF47' },
  { name: 'Trendyol',    sales: 28140, orders: 162, share: 0.31, color: '#F27A1A' },
  { name: 'Hepsiburada', sales: 14820, orders:  88, share: 0.16, color: '#FF6000' },
  { name: 'Amazon TR',   sales: 10120, orders:  54, share: 0.11, color: '#FF9900' },
];

// ============================================================
// Active product
// ============================================================
const ACTIVE_PRODUCT = {
  id: 'op-skin-crm',
  name: 'OP Aydınlatıcı Krem 50ml',
  sku: 'OP-CRM-50ML',
  category: 'Cilt Bakımı',
  stage: 'Ölçeklendirme',
  market: 'Türkiye',
  budget: '5–25k ₺/ay',
  channels: ['Shopify', 'Trendyol', 'Hepsiburada', 'Amazon TR'],
};

// ============================================================
// Task graph nodes for the DAG demo
// ============================================================
const SAMPLE_GRAPH = {
  task: 'Marka bilinirliğini artır + dönüşümü %2.5 üstüne çıkar',
  goal: '"OP Aydınlatıcı Krem" için Mayıs ayı sonu büyüme kampanyası planı.',
  nodes: [
    { id: 'n1', agent: 'supervisor',               status: 'done',    label: 'Görev planlama',         depth: 0, x: 80,  y: 40,  ms: 1240 },
    { id: 'n2', agent: 'market_research_agent',    status: 'done',    label: 'Pazar & rakip taraması', depth: 1, x: 280, y: 0,   ms: 4820 },
    { id: 'n3', agent: 'analytics_agent',          status: 'done',    label: 'Son 30 gün performans',  depth: 1, x: 280, y: 80,  ms: 2480 },
    { id: 'n4', agent: 'pricing_agent',            status: 'running', label: 'Fiyat & marj analizi',   depth: 2, x: 500, y: 0,   ms: 0    },
    { id: 'n5', agent: 'marketing_agent',          status: 'running', label: 'Kampanya draft',         depth: 2, x: 500, y: 80,  ms: 0    },
    { id: 'n6', agent: 'content_seo_agent',        status: 'queued',  label: 'İçerik briefi',          depth: 3, x: 720, y: 40,  ms: 0    },
    { id: 'n7', agent: 'critic',                   status: 'queued',  label: 'Çıktı kalite skoru',     depth: 4, x: 920, y: 40,  ms: 0    },
  ],
  edges: [
    ['n1','n2'], ['n1','n3'],
    ['n2','n4'], ['n2','n5'], ['n3','n4'], ['n3','n5'],
    ['n4','n6'], ['n5','n6'],
    ['n6','n7'],
  ],
};

// ============================================================
// Sample supervisor chat
// ============================================================
const SAMPLE_CHAT = [
  {
    role: 'user',
    ts: '14:21:03',
    content: 'Mayıs ayında Trendyol kanalını büyütmek istiyorum. Önce mevcut durumu özetle, sonra büyüme planını çıkar.',
  },
];

window.AGENT_OS_DATA = {
  AGENTS, AGENT_BY_ID, LAYER_LABELS,
  TOOLS, TOOL_CATEGORIES,
  APPROVALS, SCHEDULED,
  EVENT_TEMPLATES, EVENT_AGENTS, EVENT_TOOLS,
  SEED_EVENTS, makeEvent,
  SALES_TREND, CHANNELS,
  ACTIVE_PRODUCT,
  SAMPLE_GRAPH, SAMPLE_CHAT,
};
