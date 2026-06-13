# Tool Manifest Registry

**Konum:** `backend/apps/api/tools/manifests/` (JSON) + `backend/apps/api/tools/live/` (Python adapters).

## Sayım (CLAUDE.md ile senkron)
- **16 manifest dosyası**, **91 tool kaydı** (47 live + 44 mock).
- Yeni: `agent_handoff` (coordination kategorisi) — bkz. [[Agent Mesaj Veriyolu (A2A)]].

## Manifest Dosyaları
`analytics_legal`, `autonomous_layer`, `brand_pricing`, `brand_visual`, `collectapi`, `fakestore`, `ga4_live`, `growth_review_email`, `influencer_pr`, `marketing_content`, `memory`, `ops_support`, `research`, `shopify_live`, `store_catalog`, `trendyol_live`.

## Live Adapter Kategorileri
- **External integrations:** Shopify Admin REST (3), Trendyol Partner API (4), GA4 Data API (2), FakeStoreAPI (5), CollectAPI (6 — shopping, multi-site price, FX, BIST), Gemini Image/Vision, pgvector memory, competitor scan, subagent runner, `web_search_grounded` (Gemini `googleSearch`).
- **LLM-only (Gemini)** — `llm_tools.py` (9 araç): brand_name, color_palette, persona, sentiment, draft_reply, review_response, email_sequence, listing_compliance, forbidden_word_scanner. `GEMINI_API_KEY` yoksa `degraded=True` ile deterministik fallback.
- **Deterministic compute** — `compute_tools.py` (10 araç): margin, cogs, campaign_discount, autonomy_policy_check, stock_forecast, ab_test_designer, niche_scorer, trend_detector, anomaly_detector, return_policy_generator. Pure Python.

> Her live adapter `core/openclaw/breaker.py` ile sarılır. OPEN circuit veya eksik credential → mock + `degraded: true`.

## Yeni Tool Ekleme (5 adım)
1. Uygun manifest JSON'a kayıt ekle (`allowed_agents` zorunlu).
2. Mock: `mock_router.py` kategorisi yoksa template ekle.
3. Live: `apps/api/main.py` lifespan'da `register_live_adapter()` çağır.
4. Manifest'te `"mode": "live"` veya `"mock"`.
5. Test: `test_registry.py` + `test_openclaw.py`.

> README ve CLAUDE.md'deki sayım satırını güncellemeyi unutma.

## İlgili
- [[OpenClaw Tool Layer]] — çağrı katmanı.
- [[Agent Katmanı]] — `allowed_agents` matrisi.
