# Frontend Sayfalar

**Konum:** `frontend/src/pages/` + route haritası `App.tsx` → `PAGES`.

## Aktif Sayfalar (21 bileşen)

| Route key | Bileşen | Amaç |
|-----------|---------|------|
| `dashboard` / `console` | `DashboardPage` | Ana özet paneli |
| `supervisor` / `chat` | `ChatPage` | Hermes supervisor sohbeti |
| `graph` | `GraphPage` | TaskGraph görselleştirme |
| `office` / `agents` | `AgentsPage` | Ajan listesi ve detay |
| `approvals` / `tasks` | `WorkQueuePage` | Onay kuyruğu ve görevler |
| `tools` | `ToolsPage` | OpenClaw araç kataloğu |
| `audit` | `AuditPage` | Tool/agent audit log |
| `brand` | `BrandPage` | Marka kimliği |
| `pricing` | `PricingPage` | Fiyatlandırma |
| `growth` | `GrowthPage` | Büyüme optimizasyonu |
| `org` | `OrgPage` | Org chart (Paperclip) |
| `goals` | `GoalsPage` | Hedef ağacı |
| `budgets` | `BudgetsPage` | Ajan aylık bütçe |
| `llm_config` | `LLMConfigPage` | LLM/provider ayarları |
| `products` | `ProductsPage` | Ürün bağlamı |
| `autonomy_console` | `AutonomyConsolePage` | Otonomi karar konsolu |
| `onboarding` | `OnboardingPage` | İlk kurulum sihirbazı |
| `tic_products` | `TicProductsPage` | TIC envanter |
| `tic_orders` | `TicOrdersPage` | TIC siparişler |
| `shopping` | `ShoppingAgentPage` | Shopping agent crawler UI |
| `integrations` | `IntegrationsPage` | Legacy entegrasyonlar |

Hub sayfaları `UnifiedConsolePage` ile sarılır (`lib/navigation/hubs.ts`).

## Placeholder Route'lar

`App.tsx` içinde `PLACEHOLDER_LABELS`: reviews, influencers, email_flows, autonomy, scheduler, knowledge, analytics, settings — henüz ayrı page bileşeni yok.

## Legacy

- `pages/legacy/TasksPage.tsx`, `IntegrationsPage.tsx` — eski akışlar; yalnızca `integrations` route'u aktif.

## İlgili

- [[Frontend Mimarisi]], [[Frontend API Katmanı]], [[Backend API Routes]].
