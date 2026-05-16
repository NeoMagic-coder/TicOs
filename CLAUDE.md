# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

OneProduct Agent OS — a multi-agent e-commerce platform built around a single product. Two cooperative layers:

- **Hermes** (`apps/api/core/hermes/`) — orchestrator. Parses a user request, builds a `TaskGraph`, runs ready nodes in parallel via `asyncio.gather`, merges results with an LLM-generated executive summary in Turkish.
- **OpenClaw** (`apps/api/core/openclaw/`) — tool-use layer. Self-describing JSON manifest registry, permission-scoped execution, JSON-schema input validation, retry, fallback, audit log, and per-context cost/budget tracking.

The frontend is a Vite + React 19 SPA that talks to the FastAPI backend; it can also run standalone (Gemini called directly from the browser). The user-facing language is **Turkish** — agent system prompts, summaries, and most UI strings are in Turkish. Preserve this when editing.

## Commands

```bash
# Frontend dev (http://localhost:5173)
npm install
npm run dev

# Backend dev (http://localhost:8000, docs at /docs)
pip install -r apps/api/requirements.txt
uvicorn apps.api.main:app --reload --port 8000

# Both together
scripts/dev.sh

# Reproducible dev shell (Nix)
nix develop

# Full check: tsc --noEmit + vite build + pytest
scripts/check.sh

# Backend tests only
pytest apps/api/tests -q

# Single test
pytest apps/api/tests/test_task_graph.py::test_name -q

# Whitepaper build
make -C docs/whitepaper
```

Note: `vite.config.ts` uses `vite-plugin-singlefile`, so `npm run build` inlines everything into one HTML.

## Environment

`.env.local` (gitignored). Without keys the frontend warns and the backend falls back to `MockProvider` — flows still work end-to-end.

```
VITE_GEMINI_API_KEY=AIza...
VITE_GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash
```

## Backend API routes

```
GET    /health
POST   /api/v1/chat              # Hermes orchestration — DAG + merge
GET    /api/v1/agents
GET    /api/v1/agents/{id}
GET    /api/v1/tools             # ?category= ?agent_id=
GET    /api/v1/tools/{id}
POST   /api/v1/tools/execute     # single tool call, permission-checked
GET    /api/v1/tasks
POST   /api/v1/tasks
GET    /api/v1/approvals
POST   /api/v1/approvals/{id}/{approve|reject}
```

OpenAPI docs at `http://localhost:8000/docs`.

## Architecture notes

### Request lifecycle (backend)
1. `POST /api/v1/chat` → `HermesOrchestrator.handle()` in `apps/api/core/hermes/orchestrator.py`.
2. `router.route()` picks `primary_agent` + `supporting` from the active agent set.
3. `_plan()` builds a `TaskGraph`: supporting nodes depend on the primary node, so they run in a second wave after the primary completes.
4. Each node runs via `BaseAgent.run()` → may call tools through `OpenClawExecutor.execute()`. Every tool call is appended to `ExecutionContext.audit` (this is what `tools_used` in the response is derived from).
5. `_merge()` asks the LLM for a Turkish executive summary; falls back to a bulleted digest if the LLM errors. Confidence = mean of agent confidences; below `orchestrator_low_confidence_threshold` the result is marked `escalated`.

### Adding an agent

Worked example: adding `inventory_forecast_agent` (envanter tahmini uzmanı).

1. **Create the spec** in `apps/api/agents/seed.py` — append a new `_spec(...)`
   to the `SEED_AGENTS` list:
   ```python
   _spec(
       agent_id="inventory_forecast_agent",
       name="Inventory Forecast Agent",
       role="Envanter Tahmini & Reorder",
       goal="SKU bazlı talebi tahmin et, reorder noktasını öner.",
       personality="Sayısal, riske duyarlı.", icon="📈", color="#0ea5e9",
       allowed_tools=["stock_forecast", "stock_levels_query", "order_list"],
       allowed_tool_categories=["stock", "order"],
   ),
   ```
2. **Implement the class** in `apps/api/agents/specialized.py` (above
   `GenericAgent`):
   ```python
   class InventoryForecastAgent(BaseAgent):
       primary_tools = ["stock_forecast", "stock_levels_query", "order_list"]

       def system_prompt(self, ctx: dict[str, Any]) -> str:
           return (
               "Sen Inventory Forecast Agent'sın. Geçmiş sipariş hızı + "
               "mevcut stok + lead time'dan reorder noktasını ve güvenlik "
               "stoğunu hesaplarsın. Her SKU için tahmin aralığı (alt/üst) ver; "
               "tükenmeye <14 gün kalan kalemleri ⚠️ ile işaretle.\n\n"
               + _product_block(ctx)
           )
   ```
3. **Register the class** in `AGENT_CLASSES` (sonundaki sözlük):
   ```python
   "inventory_forecast_agent": InventoryForecastAgent,
   ```
   Kayıt eksikse `agent_class_for()` `GenericAgent`'a düşer ve özel prompt
   devre dışı kalır.
4. **Wire keywords** in `apps/api/core/hermes/router.py` (`_KEYWORDS`):
   ```python
   "inventory_forecast_agent": ("stok", "reorder", "tükenme", "envanter tahmin"),
   ```
   Lowercase Türkçe kökler kullan; `LLMRouter` keyword fallback için bunu okur.
5. **Add tests:**
   - `apps/api/tests/test_router.py`: `"reorder noktası ne olmalı?"` →
     `primary_agent == "inventory_forecast_agent"`.
   - `apps/api/tests/test_orchestrator.py`: `orchestrator` fixture'ı ile E2E
     senaryo (fixture `get_llm_provider`'ı monkey-patch'liyor, Gemini'ye
     gitmez).

### Adding a tool

Worked example: `restock_alert_builder` (yeni `stock` aracı,
`inventory_forecast_agent`'a izinli).

1. **Write the manifest.** `apps/api/tools/manifests/` altında uygun bir JSON
   dosyasına ekle (mevcut kümeyi takip et: stok araçları
   `ops_support.json`'da). Liste formatı tercih edilir — loader hem objeyi
   hem listeyi kabul eder (`registry.py:31-39`):
   ```json
   {
     "tool_id": "restock_alert_builder",
     "name": "Restock Alert Builder",
     "description": "SKU bazlı tükenme uyarısı üretir.",
     "category": "stock",
     "provider": "internal",
     "input_schema": {
       "type": "object",
       "properties": {
         "sku": {"type": "string"},
         "lead_time_days": {"type": "integer", "minimum": 1},
         "safety_stock_days": {"type": "integer", "minimum": 0, "default": 7}
       },
       "required": ["sku", "lead_time_days"]
     },
     "output_schema": {
       "type": "object",
       "properties": {
         "reorder_point": {"type": "integer"},
         "days_until_stockout": {"type": "integer"},
         "severity": {"type": "string", "enum": ["ok", "warning", "critical"]}
       }
     },
     "allowed_agents": ["inventory_forecast_agent", "operations_agent"],
     "cost_estimate_usd": 0.001,
     "mode": "mock",
     "tags": ["stock", "alert"]
   }
   ```
2. **`allowed_agents`** `ToolRegistry.is_allowed`'da zorunlu kılınır; izinsiz
   ajan çağırırsa executor `PermissionDenied` ile reddeder ve audit log'a
   `openclaw.permission_denied` event'i düşer. Boş liste "tüm ajanlar"
   anlamına gelir — açık yazmayı tercih et.
3. **`input_schema`** `jsonschema` ile execution öncesi doğrulanır
   (`validator.py`). Başarısız olursa executor raise etmez,
   `ToolExecutionResult(status="failure")` döner — bu agent için graceful
   degradation sağlar.
4. **Mock vs live:**
   - **Mock** (varsayılan): `mock_router.py` `_CATEGORY_TEMPLATES[category]`'a
     bakar. `stock` kategorisinin template'i zaten var, yeni tool otomatik
     çalışır.
   - **Live**: `apps/api/main.py` lifespan'inde:
     ```python
     from apps.api.core.openclaw.executor import register_live_adapter

     async def _restock_adapter(payload: dict) -> dict:
         # gerçek hesaplama veya 3rd-party çağrısı
         return {"reorder_point": 120, "days_until_stockout": 9, "severity": "warning"}

     register_live_adapter("restock_alert_builder", _restock_adapter)
     ```
     Manifest'i `"mode": "live"` yap. Adapter yoksa executor mock'a düşmez —
     `failure` döner.
5. **Yeni kategori eklerken** `_CATEGORY_TEMPLATES`'a (`mock_router.py`) eşleşen
   bir kayıt ekle, yoksa mock response sadece `{"ok": true}` döner ve UI'da
   sayısal alanlar boş görünür.
6. **Test:** `apps/api/tests/test_registry.py`'a manifest sayısı / kategori
   filtresi assertion'ı; `test_openclaw.py`'a permission ve schema-validation
   senaryosu ekle.

> **README sayım eşleşmesi:** Yeni manifest eklediysen
> `CLAUDE.md` "Counts of record" bölümündeki **54 manifest** sayısını ve
> `README.md`'deki aynı sayıyı güncelle.

### Counts of record (sync with README)

- **Agents**: 22 specs in `seed.py`, 22 concrete classes in `specialized.py`
  (`AGENT_CLASSES` map). No agent uses the `GenericAgent` fallback. The
  multi-agent autonomy layer adds 4 agents: `negotiation_agent`,
  `logistics_agent`, `dynamic_pricing_agent`, `autonomous_decision_agent`.
- **Tool manifests**: 12 JSON files under `apps/api/tools/manifests/`,
  69 manifest entries total (includes Sahibinden + Dolap listing/onboard tools). The `autonomous_layer.json` file groups
  negotiation, logistics, dynamic-pricing and decision-policy tools. Most are `mode: "mock"`; live adapters:
  `brand_visual_generator` (Gemini image), `memory_search` (pgvector via
  `apps.api.core.memory.store`), and three Shopify Admin REST tools
  (`shopify_store_setup`, `shopify_get_orders`, `shopify_update_inventory`)
  wrapped with `apps.api.core.openclaw.breaker` so an OPEN circuit or
  missing credentials degrade to mock with `degraded: true` in the payload.

If you add or remove agents/tools, update both these numbers and the
matching sentence in `README.md`.

### Frontend
- `src/stores/useStore.ts` is the single Zustand store. Pages in `src/pages/` are thin views over it. Layout/sidebar in `src/components/`. Path alias `@` → `src/`.
- The frontend currently calls Gemini directly from the browser (see README security note). Treat it as a clickable prototype; production flows must go through `apps/api`.

### LLM provider
- `apps/api/core/llm/provider.py` exposes `get_llm_provider()` — returns Gemini if `GEMINI_API_KEY` is set, otherwise `MockProvider`. All orchestrator/agent code must go through this abstraction so tests run without network.

## Tests

`pytest-asyncio` is used; async tests are expected. Tests live in
`apps/api/tests/` and cover orchestration primitives (`test_task_graph.py`,
`test_router.py`), the tool layer (`test_openclaw.py`, `test_registry.py`),
and a Hermes end-to-end suite (`test_orchestrator.py`) that monkey-patches
`get_llm_provider` to inject a deterministic stub so the full
`route → plan → run agents → merge` lifecycle runs offline.

Frontend smoke tests use Playwright (config at `playwright.config.ts`,
specs under `tests/e2e/`). First-time setup:

```bash
npm install                    # installs @playwright/test as a devDep
npx playwright install chromium
npm run test:e2e
```

`webServer.command = "npm run dev"` boots Vite automatically.

## Conventions

- Python: `from __future__ import annotations` at the top of every module; PEP 604 unions (`X | None`); dataclasses for value objects; Pydantic for schemas in `apps/api/models/schemas.py`.
- Logging: use `apps.api.core.logging.get_logger(__name__)` (structlog). Event names are dotted lowercase (`hermes.task.created`, `openclaw.permission_denied`).
- User-visible strings stay Turkish.
