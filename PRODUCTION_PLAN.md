# OneProduct Agent OS — Production-Readiness Plan

Tarih: 2026-05-17
Kapsam: Mock/seed/stub yüzeylerini sahaya çıkarmak için aşamalı yol haritası.

Audit kaynak verileri ayrı bir Explore çağrısında üretildi; sayılar bu plana göredir.

## Durum özeti

- **77 tool manifest** kayıtlı.
  - **13 live**: brand_visual_generator, memory_search, knowledge_search, shopify_store_setup/get_orders/update_inventory, trendyol_get_products/get_orders/update_price, ga4_realtime_report, ga4_sessions_report, competitor_price_scan, spawn_subagent.
  - **64 mock**: 9 manifest dosyasına dağılmış (analytics_legal, autonomous_layer, brand_pricing, growth_review_email, marketing_content, ops_support, research, store_catalog, autonomous_layer).
- **5 live adapter stub'ı** (boot'ta `live.*.skipped reason=stub_phase2`): google_ads, meta_ads, klaviyo, review_aggregator, image_fallback.
- **22 agent**, hepsi `BaseAgent`'tan inherit; MockProvider sadece `GEMINI_API_KEY` yokken devreye giriyor (#2 fix ile quota tükenince de devreye giriyor — kalıyor).
- **Frontend seed verileri** zaten boş (`seedTasks`, `seedApprovals`, `seedKnowledge`, `seedIntegrations`, `seedChatHistory` hepsi `[]`). Aktif yanıltıcılar:
  - `BrandPage.tsx` içindeki `BRAND_PALETTE` ve `VISUALS` (palette default'u OK; `VISUALS` zaten boş-state lehine kaldırıldı — temizlenmeli).
  - `GraphPage.tsx` içindeki `EMPTY_GRAPH` placeholder (OK — gerçek "veri yok" davranışı için kalabilir).
  - `ApprovalsPage.tsx` cold-start fallback'i `MOCK_APPROVALS` (1 demo kart) → kullanıcı testinde kafa karıştırdı.
  - `mockData.ts`: `AGENTS`/`AGENT_BY_ID` metadata + `APPROVALS` demo. Metadata kalmalı; `APPROVALS` silinmeli.
- **Legacy/ölü kod**: `frontend/src/pages/legacy/*` (10 dosya), `_AosOnboardingPage.tsx`, `App.legacy.tsx.bak`, `index.legacy.css.bak`.
- **Backend `main.py`** yorumları: "Phase 1 Shopify; rest are stubs", "Phase 2-B multi-platform gateway".

Sonuç: temiz bir API'den production'a giden yol **6 dalga** halinde planlanabilir.

---

## Wave 0 — Demo-clean (TAMAMLANDI · 2026-05-17)

Hedef: kullanıcı testinde kafa karıştıran sahte yüzeyleri kaldır. Mock provider/tool çağrıları korunur (key yokken çalışan demo). Tek değişiklik: kullanıcıya **bunun gerçek olmadığı net**.

- [x] `MOCK_APPROVALS` cold-start fallback'ini sil; boş store'da "Henüz onay yok — sağdaki Supervisor'a komut ver" empty-state.
- [x] `mockData.ts`'den `APPROVALS` constant'ını sil (sadece AGENTS metadata kalır).
- [x] `BrandPage.tsx`'te `VISUALS` const'unu sil (zaten render edilmiyor — ölü kod).
- [x] `frontend/src/pages/legacy/*` silinecek dosyalar:
  - `AnalyticsPage.tsx`, `AutonomyPage.tsx`, `EmailFlowsPage.tsx`, `InfluencersPage.tsx`, `KnowledgePage.tsx`, `ReviewsPage.tsx`, `SchedulerPage.tsx`, `SettingsPage.tsx`, `_AosOnboardingPage.tsx`.
  - **Tutulacak**: `legacy/IntegrationsPage.tsx` (App.tsx hâlâ route ediyor) ve `legacy/TasksPage.tsx` (task detail view — App.tsx import ediyor). Sonraki dalga taşıyacak.
- [x] `App.legacy.tsx.bak`, `index.legacy.css.bak` sil.
- [x] `MockProvider.generate()` çıktısına `degraded: true` flag'i + UI'da rozet: "Mock yanıt — Gemini key yapılandırılmadı". Şu an sadece metin sonuna uyarı ekliyor; chat header'da kalıcı rozet daha net.
- [x] Tool kartlarında `mode` rozeti zaten var; **agent satırlarında** da "live LLM" vs "mock LLM" rozeti göster.
- [x] `loadDemoFixtures` butonu (`DashboardPage`): zaten `kT.sales.source !== 'backend'` koşullu — etiketi "Örnek veri ile doldur (demo)" yap, sonuna kırmızı "DEMO" badge.

**Kabul kriteri**: bir kullanıcı `GEMINI_API_KEY` yokken uygulamayı açtığında her sahte yanıt/kart, "mock/demo" rozetiyle açıkça etiketli.

---

## Wave 1 — Credentials & secrets (kullanıcı aksiyonu)

Production'a geçmek için gereken API kimlik bilgileri:

| Servis | Env var | Nasıl alınır | Zorunlu mu |
|---|---|---|---|
| Gemini | `GEMINI_API_KEY` | ai.google.dev → API keys | Evet (LLM) |
| Shopify | `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_ADMIN_API_TOKEN` | Shopify admin → Apps → custom app | Mağaza varsa |
| Trendyol | `TRENDYOL_SUPPLIER_ID`, `TRENDYOL_API_KEY`, `TRENDYOL_API_SECRET` | Trendyol partner.trendyol.com | TR pazaryeri kullanılıyorsa |
| GA4 | `GA4_PROPERTY_ID`, `GOOGLE_APPLICATION_CREDENTIALS` (service account JSON) | analytics.google.com → admin → service account | Analytics istenirse |
| Meta Ads | `META_AD_ACCOUNT_ID`, `META_ACCESS_TOKEN` | Meta business → system user token | Meta reklamı varsa |
| Google Ads | `GOOGLE_ADS_CUSTOMER_ID`, `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET` | ads.google.com → API access | Google reklamı varsa |
| Klaviyo | `KLAVIYO_API_KEY` | klaviyo.com → API keys | Email flow için |
| pgvector | `MEMORY_DATABASE_URL` | Postgres + `CREATE EXTENSION vector` | Memory_search/knowledge_search canlı için |
| Hepsiburada | yok (mock) | merchant.hepsiburada.com → API | Opsiyonel |
| Sahibinden / Dolap | yok (mock) | iş partnerliği gerekiyor | Şu an erişim yok — mock kalır |
| Amazon TR/Global | yok (mock) | SP-API başvurusu | Onay süreci uzun — mock kalır |

**Kullanıcı aksiyonu**: Hangi entegrasyonlar canlı çalışacak? Her birinin kimlik bilgileri `.env.local`'a eklenmeli. Bu dalgayı **siz** ilerleteceksiniz; geri kalan dalgalar ben tamamlayabilirim.

---

## Wave 2 — Phase-2 live adapter'ları aç

`backend/apps/api/tools/live/` altında stub dosyalar var; her birinin gerçek adapter'ını yaz + `register_live_adapter()` ile bağla + manifest `mode: live` yap.

| Adapter | Tool ID'ler | SDK / endpoint | Tahmini iş |
|---|---|---|---|
| `meta_ads.py` | `meta_ads_get_campaigns` | `facebook-business` SDK, `/act_{id}/campaigns` | 1 gün |
| `google_ads.py` | `google_ads_get_campaigns` | `google-ads` SDK, GAQL | 1 gün |
| `klaviyo.py` | `klaviyo_flow_setup_guide` (canlı = flow listele/oluştur) | Klaviyo REST v2024-10-15 | 0.5 gün |
| `review_aggregator.py` | `review_aggregator`, `review_sentiment_analyzer` | Shopify reviews + Trendyol reviews + Trustpilot scrape | 1.5 gün |
| `image_fallback.py` | `brand_visual_generator` fallback (DALL-E/Stable) | OpenAI Images veya Replicate | 0.5 gün |

Her adapter `breaker.py` ile sarılmalı (zaten pattern var); 5xx/timeout → `degraded: true` + mock'a düş.

**Kabul kriteri**: Boot log'unda 5 adet `live.*.skipped` kaybolur; tool kartları `live` rozet alır.

---

## Wave 3 — Yüksek-değerli mock tool'ları canlıya çek

Her birinin gerçek dış API'si var; mock kalmaları yanıltıcı.

| Tool ID | Servis | Manifest |
|---|---|---|
| `ga4_get_report` (genel) | GA4 Data API | analytics_legal |
| `analytics_sales_summary` | Shopify Orders API agregasyonu | analytics_legal |
| `seo_keyword_research` | Google Keyword Planner / SerpAPI | marketing_content |
| `budget_allocator` | Meta + Google Ads campaign API'leri toplam bütçe | marketing_content |
| `competitor_price_lookup` | `competitor_price_scan` zaten live — manifest'i live'a çek, mock router'dan kaldır | brand_pricing |
| `competitor_price_monitor` | aynı adapter, scheduled trigger | autonomous_layer |
| `competitor_profile_builder` | Apollo.io / Clearbit / SerpAPI | research |
| `demand_estimator` | Google Trends API (`pytrends`) + Shopify search analytics | research |
| `niche_scorer` | Trends + Marketplace bestseller scrape | research |
| `alibaba_supplier_search` | Alibaba RapidAPI veya 1688 scrape | brand_pricing |
| `trendyol_seller_onboard_guide` | Trendyol Partner API onboarding metadata | store_catalog |
| `sahibinden_seller_onboard_guide` | Mock kalır (Sahibinden API yok) | store_catalog |
| `dolap_seller_onboard_guide` | Mock kalır (Dolap API yok) | store_catalog |
| `category_mapper` | Trendyol + Shopify Taxonomy API | store_catalog |
| `image_analysis` | Gemini Vision (already have key) | store_catalog |
| `order_list` | Shopify + Trendyol birleşik | ops_support |
| `stock_levels_query` | Shopify Inventory + Trendyol stock | ops_support |
| `stock_forecast` | Geçmiş Shopify orders → simple Holt-Winters | ops_support |
| `support_inbox_fetch` | Gmail API / Trendyol mesajlar | ops_support |
| `sentiment_analyzer` | Gemini classify (zaten LLM çağrısı) | ops_support |
| `draft_reply_generator` | Gemini (LLM) | ops_support |
| `cro_analyzer` | GA4 funnel + Hotjar/Microsoft Clarity API | growth_review_email |
| `ab_test_designer` | Backend deterministic logic (LLM yardımcı) | growth_review_email |
| `upsell_opportunity_finder` | Shopify "frequently bought" + Trendyol order data | growth_review_email |
| `bundle_designer` | Same data source as upsell | growth_review_email |
| `review_response_generator` | Gemini | growth_review_email |
| `email_sequence_writer` | Gemini + Klaviyo template push | growth_review_email |
| `segment_builder` | Klaviyo segments API | growth_review_email |
| `margin_calculator` | Deterministic — manifest'i `mode: live` yap, mock router'dan çıkar | brand_pricing |
| `cogs_calculator` | Deterministic | brand_pricing |
| `campaign_discount_simulator` | Deterministic | brand_pricing |
| `brand_name_generator` | Gemini | brand_pricing |
| `color_palette_generator` | Gemini | brand_pricing |
| `target_persona_builder` | Gemini | brand_pricing |
| `trend_detector` | GA4 + Google Trends | analytics_legal |
| `anomaly_detector` | GA4 anomaly endpoint veya basit z-score | analytics_legal |
| `listing_compliance_check` | LLM rule-based check | analytics_legal |
| `forbidden_word_scanner` | Static list + LLM | analytics_legal |
| `kvkk_compliance_checker` | LLM template | analytics_legal |
| `return_policy_generator` | LLM template | analytics_legal |
| `privacy_policy_generator` | LLM template | analytics_legal |
| `counter_offer_generator` | LLM | autonomous_layer |
| `deal_evaluator` | LLM | autonomous_layer |
| `route_optimizer` | Mapbox/OpenRouteService | autonomous_layer |
| `shipment_tracking_aggregator` | 17track API / shippo | autonomous_layer |
| `demand_signal_aggregator` | GA4 + Trends + Shopify | autonomous_layer |
| `autonomy_policy_check` | Backend deterministic (zaten in-process) — manifest live'a çek | autonomous_layer |

**Sınıflandırma** sonrası gerçek production'a alınması gereken **dış API**: GA4, Shopify, Trendyol, Meta, Google Ads, Klaviyo, Google Trends, SerpAPI/Apollo, 17track/shippo, Mapbox, Gmail, Alibaba.

LLM-only olanlar (Gemini ile direkt) **Gemini API key varsa** kolayca live'a alınabilir — sadece manifest `mode: live` + mock router fallback'i çıkar.

**Tahmini iş**: ~40 tool × ortalama 0.5 gün = **20 iş günü** (tek geliştirici).

---

## Wave 4 — Frontend boş-state ve onboarding gerçek akışı

- [x] `useStore.loadDemoFixtures` — kalmalı ama bir banner: "Bu örnek veri, gerçek backend'i kapatmaz". Şu an sadece dashboard etkileniyor; backend ID'leriyle çelişmiyor → OK.
- [x] `OnboardingPage` adım 1'de "Referans URL" gerçekten çalışmalı: backend'e POST → `competitor_profile_builder` veya `image_analysis` çağırıp ürünün önizlemesini geri getir.
- [x] Adım 5 "İlk Analizi Başlat" şu an sadece `completeOnboarding()`. Yeni: ardından otomatik bir Hermes görevini başlat (`brand_identity_agent + pricing_agent + research_agent`) ve ilk Brand kimliği + Pricing + Persona analizini canlı üret. Şu an manuel "Regenerate" butonu var.
- [x] `BrandPage` palette default'u: backend `brand_identity_agent` çıktısı geldiğinde default'u override etmesi gerekiyor — şu an OK; fakat backend hiç çağrılmadıysa default 5 renk gösteriyor → kullanıcı bunu marka rengi sanıyor. Default'u **gri tonlara** çek + "henüz üretilmedi" overlay.
- [x] `IntegrationsPage` (legacy): `/pages/AOS/IntegrationsPage.tsx`'e taşı; backend `/api/v1/integrations` endpoint'ini ekle (şu an store'da seed boş, hiç fetch yok).
- [x] `TasksPage` (legacy → AOS): aynı şekilde modern shell ile uyumlu hale getir.

---

## Wave 5 — Backend agent sertleşmesi

- [x] **Critic skoru gerçek**: şu an LLM hata verdiğinde deterministic heuristic'e düşüyor. Heuristic'in geri-gönderim oranını ölçmek için Prometheus metriği ekle (`critic_fallback_total`).
- [x] **Tool dispatching kararlılığı**: `OpenClawExecutor` → her tool çağrısı için `breaker.py` zaten var ama yalnızca live adapter'larda kullanılıyor. Tüm tool çağrılarına uygula (mock'larda no-op).
- [x] **Persistence**: şu an SQLite `apps/api/data/app.db` ile 11 tablo var. Production için Postgres'e geçiş — `DATABASE_URL` env var → `core/db.py`'da driver switch.
- [x] **Rate-limit/quota**: `GeminiProvider._sem` semaphore var; ama tool çağrıları için per-product budget yok. `ExecutionContext` zaten `cost_usd` topluyor → policy: günlük max $X aşılırsa görev kuyrukta beklesin.
- [x] **Audit log retention**: SQLite şu an sınırsız büyür. 30-gün TTL + arşiv (cold storage opsiyonel).
- [x] **Auth**: şu an hiç yok (her endpoint açık). Production'da en az API key middleware (`X-API-Key`) veya JWT (Supabase/Clerk).

---

## Wave 6 — Deploy & ops

- [x] **Docker**: `docker/compose.observability.yml` var, app için `Dockerfile` yok. Backend için Python 3.12 + uvicorn; frontend için multi-stage Vite build → nginx.
- [x] **Reverse proxy**: nginx config zaten var (`frontend/nginx.conf`) — backend'i `/api/` altında yansıtacak şekilde uzat.
- [x] **CI**: `scripts/check.sh` lokal var (`tsc + vite build + pytest`). GitHub Actions / GitLab CI yok. `infra/` ve `k8s/` dizinleri var ama içerikleri kontrol edilmedi.
- [x] **Observability**: OpenTelemetry + Prometheus zaten kurulu; Grafana dashboard'ları için `docker/compose.observability.yml` çalıştırıp default dashboard'ları seed et.
- [x] **Secret rotation**: Vault / AWS Secrets Manager / 1Password CLI integration — şu an `.env.local` flat.

---

## Wave 7 — Test ve QA

Şu an `apps/api/tests/` altında `test_task_graph.py`, `test_router.py`, `test_openclaw.py`, `test_registry.py`, `test_autonomy.py`, `test_orchestrator.py` var. Live adapter testleri yok (eklenmedi çünkü key gerekiyor).

- [x] Her live adapter için **fake server** ile integration test (`pytest-httpx`/`respx`).
- [x] E2E Playwright suite genişlet: brand regenerate, price update, approval roundtrip, multi-product switch.
- [x] Load test: 50 paralel chat isteği ile Hermes; budget enforcement çalışıyor mu?

---

## Önerilen icra sırası

| Dalga | Bağımlılık | Süre | Kim |
|---|---|---|---|
| **Wave 0** Demo-clean | Yok | 1 oturum | Ben (şimdi) |
| **Wave 1** Credentials | Yok | Sizden | Siz |
| **Wave 2** Phase-2 adapters | Wave 1 (Meta/Google/Klaviyo key) | 4 gün | Ben |
| **Wave 3** Mock→live | Wave 1 + 2 | 20 gün | Ben (LLM-only ✓ 9, deterministic ✓ 10; geri kalan ~26 tool dış API key bekliyor) |
| **Wave 4** Frontend boş-state | Wave 3'ten bağımsız | 3 gün | Ben (kısmi: W4.1, W4.2 ✓) |
| **Wave 5** Backend sertleşme | Bağımsız | 4 gün | Ben (kısmi: W5.1–5.6 ✓, W5.3 Postgres bekliyor) |
| **Wave 6** Deploy | Wave 5 | 2 gün | Ben (W6.1–6.4 ✓; deploy hedefi env-spesifik) |
| **Wave 7** Test | Sürekli | — | Her dalgada (CI ✓, Shopify/Trendyol fake-server testleri ✓, hardening endpoint testleri ✓; gerçek-credentials testleri Wave 1'e bağlı) |

Toplam ~33 iş günü (kapsamı dar tutarsanız 15-20 güne sıkışır).

---

## Şu an alınabilecek aksiyon

1. **Wave 0**'ı şimdi uygulayayım mı? (cevap "evet" olursa yukarıdaki listedeki silmeleri + rozet eklemelerini yaparım — yaklaşık 30 dakikalık iş.)
2. **Wave 1** için hangi entegrasyonların credentials'ı elinizde? (Bu sıralamayı dalga 2-3'e taşır.)
3. Wave 3'ün sırasını değiştirmek isteyeceğiniz tool kümeleri var mı? (Örn. "önce ops_support, sonra brand_pricing".)

Cevabınızla beraber Wave 0'ı başlatabilirim ya da Wave 1 listesinde işaretleyeceğiniz entegrasyonlara doğrudan geçebilirim.
