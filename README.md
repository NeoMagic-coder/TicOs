# OneProduct Agent OS

**Bir ürün. Tüm e-ticaret. Tamamen otonom.**

Tek ürün etrafında **22 uzman ajan + 69 tool manifesti** ile uçtan uca e-ticaret operasyonunu yöneten, **Hermes orkestrasyon + OpenClaw tool-use** mimarisi üzerine kurulu bir multi-agent platform. Frontend tıklanabilir, backend ise gerçek bir Hermes + OpenClaw çalıştırır.

> Sayılar repo gerçeğiyle eşittir: `apps/api/agents/specialized.py` içinde 22 ajan sınıfı (4'ü multi-agent otonomi katmanı: negotiation / logistics / dynamic_pricing / autonomous_decision), `apps/api/tools/manifests/` altında 12 JSON dosyası ve 69 manifest kaydı bulunur. Tool'ların büyük çoğunluğu **mock** modundadır. Live adaptörler: `brand_visual_generator` (Gemini image), `memory_search` (pgvector cosine), `shopify_store_setup` / `shopify_get_orders` / `shopify_update_inventory` (Shopify Admin REST, pybreaker circuit-breaker ile sarmalı, credentials yoksa mock'a düşer). Meta/Google Ads, Klaviyo, Trendyol/Trustpilot ve image-gen fallback'ı Faz 2 stub'ları olarak `apps/api/tools/live/` altında bekliyor.

## Mimari

İki kooperatif katman:

- **Hermes (orkestrasyon)** — `apps/api/core/hermes/`. CEO Agent talebi parse eder, DAG kurar, alt ajanlara dağıtır, sonuçları birleştirir.
- **OpenClaw (tool-use)** — `apps/api/core/openclaw/`. Self-describing JSON manifest registry, permission-scoped çağrı, sandbox + retry + fallback + audit log + cost tracking.

```
apps/
  api/                      # FastAPI backend (Python)
    core/
      hermes/               # orchestrator, task_graph, router
      openclaw/             # registry, executor, validator, mock_router, breaker
      llm/                  # provider (Gemini + mock)
    agents/                 # 22 specialized agents (incl. multi-agent autonomy layer)
    tools/manifests/        # 12 JSON dosyası, 69 manifest kaydı
    routes/                 # chat, agents, tools, tasks, approvals
    tests/                  # pytest
src/                        # Vite + React 19 + Tailwind v4 frontend
  components/               # Layout, Sidebar, ProductContextBar, SupervisorChatDock, ChatMessageBody
  pages/                    # 19 sayfa (Dashboard, Brand, Pricing, Tasks, Agents, ...)
  stores/useStore.ts        # tek Zustand store
  lib/{api,gemini}.ts       # backend + Gemini fallback client
tests/e2e/                  # 22 Playwright spec (smoke + feature coverage)
docs/whitepaper/            # LaTeX paper + BibTeX refs
scripts/                    # bash dev/build/check
flake.nix                   # reproducible dev shell
```

## Öne çıkan özellikler

- **Backend fallback** — `chatWithFallback` helper'ı (`src/lib/api.ts`): backend 5xx/timeout durumunda doğrudan Gemini'ye düşer, audit log'a `fallback_used: true` yazar. Marka/Fiyat regen flow'u backend kapalıyken bile çalışır.
- **Health badge** — header'da `/health`'i 20sn'de bir poll'lar, online/çevrimdışı/fallback durumlarını yeşil-sarı-kırmızı pill ile gösterir; sağlık skorunu da bu sinyalle düşürür.
- **Çoklu ürün switcher** — `ProductContextBar` dropdown'ı ile aktif ürün değiştirilir, "Yeni ürün ekle" → onboarding.
- **Komut paleti** — `Ctrl/⌘+K` floating Supervisor dock'u açar; header'da her zaman görünen launcher + 6sn'de bir değişen öneri chip'i.
- **Görev retry & gözlemlenebilirlik** — TaskDetail'da `Sonuç / Loglar / İterasyon` sekmeleri + "Yeniden Çalıştır" butonu. Loglar sekmesi audit kayıtlarını filtreler.
- **Ajan trace** — Agent Office kartlarında "şu an: … / son aktivite Xdk önce" mikro-status satırı; detay sayfasında son 30 trace satırı (tool çağrıları + audit + ajan replikleri).
- **Demo fixture** — boş Dashboard ve Onaylar sayfasında "Demo veriyle doldur" butonu; gerçekçi KPI'lar + 3 örnek pending approval.
- **Görsel render** — `ChatMessageBody` markdown `![alt](url)` + bare `/images/*` + bare https resim URL'lerini `<img>` olarak çıkarır. ChatPage, SupervisorChatDock ve BrandPage "Ajan Görselleri" galerisi aynı renderer'ı kullanır.
- **Türkçe inline validasyon** — onboarding adımlarında eksik alanlar `role="alert"` ile listelenir; tab/filter butonları `aria-selected` + focus-ring ile keyboard-erişilebilir.

## Hızlı başlangıç

```bash
# Frontend (tek başına çalışır, Gemini doğrudan tarayıcıdan çağrılır)
npm install
npm run dev          # http://localhost:5173

# Backend (opsiyonel — Hermes orkestratörü, real DAG, tool registry)
pip install -r apps/api/requirements.txt
uvicorn apps.api.main:app --reload --port 8000   # http://localhost:8000/docs

# İkisi birden
scripts/dev.sh

# Nix kullanıyorsan
nix develop
```

### Çevre değişkenleri

`.env.local` dosyası (gitignore'da):

```
VITE_GEMINI_API_KEY=AIza...      # frontend (browser → Gemini fallback)
VITE_GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_API_KEY=AIza...           # backend
GEMINI_MODEL=gemini-2.5-flash-lite
```

Anahtar olmadan: frontend uyarı verir; backend `MockProvider`'a düşer; akış çalışmaya devam eder. Backend kapalıysa `chatWithFallback` doğrudan Gemini'ye düşer (sadece anahtar varsa).

## Backend API

```
GET    /health
POST   /api/v1/chat              # Hermes orkestrasyon — DAG + merge
POST   /api/v1/chat/stream       # SSE: progress + final message
GET    /api/v1/agents
GET    /api/v1/agents/{id}
GET    /api/v1/tools             # ?category= ?agent_id=
GET    /api/v1/tools/{id}
POST   /api/v1/tools/execute     # tek bir tool çağrısı, permission check'li
GET    /api/v1/tasks
POST   /api/v1/tasks
GET    /api/v1/approvals
POST   /api/v1/approvals/{id}/{approve|reject}
POST   /api/v1/approvals/{id}/estimate    # LLM ile beklenen etki tahmini
```

OpenAPI dokümantasyonu: `http://localhost:8000/docs`

## Desteklenen kanallar

Onboarding ve Integrations sayfalarında:

| Kanal | Durum | Tool kümesi |
|---|---|---|
| Shopify | Live (Admin REST + breaker) | `shopify_store_setup`, `shopify_get_orders`, `shopify_update_inventory` |
| Trendyol | Mock | `trendyol_get_products`, `trendyol_category_analysis`, `trendyol_seller_onboard_guide` |
| Hepsiburada | Mock | `hb_get_products` |
| Sahibinden | Mock | `sahibinden_listing_publish`, `sahibinden_seller_onboard_guide` |
| Dolap | Mock | `dolap_listing_publish`, `dolap_seller_onboard_guide` |
| WooCommerce, N11, GittiGidiyor, Etsy, Amazon TR/Global, TikTok Shop | UI'da seçilebilir, manifest bekliyor | — |

## Whitepaper

`docs/whitepaper/` altında mimariyi anlatan LaTeX makale. Derleme:

```bash
make -C docs/whitepaper
# → docs/whitepaper/paper.pdf
```

## Test ve doğrulama

```bash
scripts/check.sh           # tsc + vite build + pytest
pytest apps/api/tests      # sadece backend

# Playwright e2e (frontend smoke + feature coverage, 22 spec)
npx playwright install chromium    # tek seferlik
npm run test:e2e
```

E2E kapsamı (`tests/e2e/`):

| Spec | Kapsam |
|---|---|
| `onboarding.spec.ts` | 5-adımlı wizard smoke + page error guard |
| `onboarding-validation.spec.ts` | Eksik alan inline alert + Devam toggle |
| `onboarding-chat-flow.spec.ts` | Onboarding → Chat → mocked backend response |
| `health-badge.spec.ts` | Backend online vs çevrimdışı pill |
| `demo-fixture.spec.ts` | Dashboard + Onaylar demo verisi |
| `product-switcher.spec.ts` | Multi-product dropdown + add-new |
| `task-retry.spec.ts` | TaskDetail sekmeleri + Yeniden Çalıştır |
| `command-palette.spec.ts` | ⌘K launcher + dock toggle |
| `marketplace-channels.spec.ts` | Sahibinden + Dolap onboarding/integrations |
| `gemini-fallback.spec.ts` | Backend 503 → Gemini'ye düşüş + brand identity render |
| `agent-trace.spec.ts` | Agent micro-status + Trace section |
| `image-rendering.spec.ts` | Dock + Brand gallery `<img>` render |

`tests/e2e/helpers/onboard.ts` — `completeOnboarding(page)` ve `stubBackend(page)` paylaşılan helper'lar.

## Diller

- **Python** — Hermes orchestrator, OpenClaw executor, FastAPI, 22 ajan, tool manifests, tests
- **TypeScript** — React 19 frontend, Zustand store, Gemini + backend client, Playwright suite
- **TeX + BibTeX** — mimari whitepaper + akademik referanslar (`oneproduct.bst` özel stil)
- **Shell** — `scripts/dev.sh`, `build.sh`, `check.sh`, `seed_api.sh`
- **Nix** — `flake.nix` ile reproducible dev environment

## Güvenlik notu

LLM API anahtarı frontend bundle'da görünür biçimde paketlenir — bu sadece **lokal prototip** için uygundur. Production için backend proxy (`apps/api`) üzerinden gitmelisiniz; backend anahtarı asla browser'a göndermez.

`apps/_images/` `brand_visual_generator` runtime çıktısı için `.gitignore`'dadır — repo'ya commit edilmez.

## Lisans

MIT.
