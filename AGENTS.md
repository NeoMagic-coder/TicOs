# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project

OneProduct Agent OS — a multi-agent e-commerce platform built around a single product. Two cooperative layers:

- **Hermes** (`apps/api/core/hermes/`) — orchestrator. Parses a user request, builds a `TaskGraph`, runs ready nodes in parallel via `asyncio.gather`, merges results with an LLM-generated executive summary in Turkish.
- **OpenClaw** (`apps/api/core/openclaw/`) — tool-use layer. Self-describing JSON manifest registry, permission-scoped execution, JSON-schema input validation, retry, fallback, audit log, and per-context cost/budget tracking.

The frontend is a Vite + React 19 SPA that talks to the FastAPI backend; it can also run standalone (Gemini called directly from the browser). The user-facing language is **Turkish** — agent system prompts, summaries, and most UI strings are in Turkish. Preserve this when editing.

## Commands

All backend commands run from the `backend/` directory; frontend commands from `frontend/`.

```bash
# Frontend dev (http://localhost:5173)
cd frontend && npm install && npm run dev

# Backend dev (http://localhost:8000, docs at /docs)
cd backend && pip install -r apps/api/requirements.txt
cd backend && uvicorn apps.api.main:app --reload --port 8000

# Both together (from repo root)
scripts/dev.sh

# Reproducible dev shell (Nix)
nix develop

# Full check: tsc --noEmit + vite build + pytest
scripts/check.sh

# Backend tests only (from backend/)
pytest apps/api/tests -q

# Single test
pytest apps/api/tests/test_task_graph.py::test_name -q

# Seed agent specs into the running backend
scripts/seed_api.sh

# Whitepaper build
make -C docs/whitepaper
```

Note: `vite.config.ts` uses `vite-plugin-singlefile`, so `npm run build` inlines everything into one HTML.

## Environment

`.env.local` (gitignored). Without keys the frontend warns and the backend falls back to `MockProvider` — flows still work end-to-end.

```
VITE_GEMINI_API_KEY=AIza...
VITE_GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash-lite
```

If the backend reports "API key not valid" even after setting `.env.local`, a stale system env var may be shadowing it. Clear it with `Remove-Item Env:GEMINI_API_KEY` (PowerShell) before restarting.

## Backend API routes

```
GET    /health
POST   /api/v1/chat              # Hermes orchestration — DAG + merge (buffered)
POST   /api/v1/chat/stream       # SSE: live progress events + final message
WS     /ws/voice                 # Voice Supervisor — audio in, intent dispatch out
GET    /api/v1/agents
GET    /api/v1/agents/{id}
GET    /api/v1/tools             # ?category= ?agent_id=
GET    /api/v1/tools/{id}
POST   /api/v1/tools/execute     # single tool call, permission-checked
GET    /api/v1/tasks
POST   /api/v1/tasks
GET    /api/v1/approvals
POST   /api/v1/approvals/{id}/{approve|reject}
POST   /api/v1/approvals/{id}/estimate    # LLM-estimated expected impact

# Paperclip layer (org chart + goals + per-agent monthly budget)
GET    /api/v1/org/units                 # 5 departments + members + heads
GET    /api/v1/org/units/{id}
GET    /api/v1/org/agents/{id}/unit      # which dept does an agent belong to
GET    /api/v1/goals                     # list (filter by status / parent)
POST   /api/v1/goals
GET    /api/v1/goals/{id}
PATCH  /api/v1/goals/{id}
DELETE /api/v1/goals/{id}                # returns {"deleted": id}
GET    /api/v1/goals/{id}/ancestors      # root-first chain
GET    /api/v1/goals/tree/full           # nested tree + task counts
GET    /api/v1/agents/budgets            # per-agent monthly budget rows
GET    /api/v1/agents/{id}/budget        # auto-creates a zero-cap row on first GET
PUT    /api/v1/agents/{id}/budget        # set limit_usd / warn_threshold_pct
```

OpenAPI docs at `http://localhost:8000/docs`.

## Architecture notes

### Request lifecycle (backend)
1. `POST /api/v1/chat` → `HermesOrchestrator.handle()` in `apps/api/core/hermes/orchestrator.py`.
2. `router.route()` picks `primary_agent` + `supporting` from the active agent set.
3. `_plan()` builds a `TaskGraph`: supporting nodes depend on the primary node, so they run in a second wave after the primary completes.
4. Each node runs via `BaseAgent.run()` → may call tools through `OpenClawExecutor.execute()`. Every tool call is appended to `ExecutionContext.audit` (this is what `tools_used` in the response is derived from).
5. **CriticAgent** (`apps/api/agents/critic.py`) scores each agent output 0.0–1.0 on three axes (concreteness, numeric grounding, hallucination risk). Below `critic_min_score` the run retries once; if still below, the result is marked `escalated`. Falls back to a deterministic heuristic when the LLM errors.
6. `_merge()` asks the LLM for a Turkish executive summary; falls back to a bulleted digest if the LLM errors. Confidence = mean of agent confidences; below `orchestrator_low_confidence_threshold` the result is marked `escalated`.

The SSE path (`POST /api/v1/chat/stream`) emits `progress` events for each lifecycle step (`task_started`, `plan_ready`, `agent_started`, `tool_called`, `critic_scored`, `agent_retry`, `agent_completed`, `merging`) and a final `message` event with the same payload as the buffered endpoint.

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
> `AGENTS.md` "Counts of record" bölümündeki sayıyı ve
> `README.md`'deki aynı sayıyı güncelle.

### Counts of record (sync with README)

- **Agents**: 22 specs in `seed.py`, 22 concrete classes in `specialized.py`
  (`AGENT_CLASSES` map). No agent uses the `GenericAgent` fallback. The
  multi-agent autonomy layer adds 4 agents: `negotiation_agent`,
  `logistics_agent`, `dynamic_pricing_agent`, `autonomous_decision_agent`.
- **Org units**: 5 departments (`yonetim`, `pazarlama`, `operasyon`,
  `finans`, `arge`) with 22 memberships seeded by `seed_default_org()`.
- **Tool manifests**: 16 JSON files under `apps/api/tools/manifests/`,
  90 manifest entries total (46 `live`, 44 `mock`). Live adapters live in
  `apps/api/tools/live/`:
  - **External integrations**: Shopify Admin REST (3), Trendyol Partner API
    (4: get_products, get_orders, update_price, create_listing),
    GA4 Data API (2), FakeStoreAPI (5: products, product detail,
    categories, carts, users), CollectAPI (6: shopping search, product
    detail, AI suggestion, multi-site price follow across Trendyol
    /Hepsiburada/n11/Amazon/GittiGidiyor, multi-currency FX conversion
    `/economy/currencyToAll`, BIST stocks `/economy/hisseSenedi`),
    Gemini Image (`brand_visual_generator`), Gemini Vision
    (`image_analysis` — ürün fotoğrafından kategori/renk/materyal çıkarır),
    pgvector memory
    (`memory_search`, `knowledge_search`), competitor scan, subagent runner,
    Google Search grounding (`web_search_grounded` — Gemini-native
    `googleSearch` tool wrapper, surfaces queries + cited source URIs).
  - **LLM-only (Gemini)** in `apps/api/tools/live/llm_tools.py` (9 tools):
    `brand_name_generator`, `color_palette_generator`,
    `target_persona_builder`, `sentiment_analyzer`, `draft_reply_generator`,
    `review_response_generator`, `email_sequence_writer`,
    `listing_compliance_check`, `forbidden_word_scanner`. Each calls
    `get_llm_provider()` directly; when no `GEMINI_API_KEY` is set they
    short-circuit to a deterministic fallback with `degraded=True`.
  - **Deterministic compute** in `apps/api/tools/live/compute_tools.py`
    (10 tools): `margin_calculator`, `cogs_calculator`,
    `campaign_discount_simulator`, `autonomy_policy_check`, `stock_forecast`,
    `ab_test_designer`, `niche_scorer`, `trend_detector`, `anomaly_detector`,
    `return_policy_generator`. Pure Python, no LLM/HTTP — reproducible numeric
    outputs replace the previous mock-router canned shapes.

  Every adapter is wrapped with `apps.api.core.openclaw.breaker` so an
  OPEN circuit or missing credentials degrade to mock with `degraded: true`
  in the payload.

If you add or remove agents/tools, update both these numbers and the
matching sentence in `README.md`.

### Autonomy layer

`apps/api/core/autonomy/` contains four modules that work together for high-confidence autonomous actions:

- **`decision_engine.py`** — Policy-gated evaluator. Given a proposed action (type, value, risk, confidence), checks it against `AutonomyPolicy` thresholds (`max_price_change_pct`, `max_carrier_switch_cost_try`, `min_confidence`, `risk_auto_threshold`). Returns `auto_approved`, `needs_approval`, or `rejected` — deterministic, no side-effects.
- **`negotiation.py`** — Multi-round negotiation protocol between `NegotiationAgent` and a supplier/counterpart.
- **`coordination.py`** — Agent-to-agent coordination and capability matching.
- **`goals.py`** — Goal decomposition for the autonomous decision agent.
- **`marketplace_router.py`** — Routes autonomous actions to the correct marketplace adapter.
- **`ontology.py`** — Shared domain vocabulary for cross-agent communication.

The four autonomy agents in `AGENT_CLASSES` (`negotiation_agent`, `logistics_agent`, `dynamic_pricing_agent`, `autonomous_decision_agent`) use these modules rather than making direct LLM calls for every decision.

### Paperclip layer (org chart + goals + per-agent monthly budget)

Three thin layers borrowed from paperclipai/paperclip. None of them replace
existing functionality — they add company-shaped structure on top of the
flat agent registry.

- **Org chart** (`apps/api/core/org/`). 5 fixed departments (`yonetim`,
  `pazarlama`, `operasyon`, `finans`, `arge`) with one head agent each and
  22 memberships covering every seeded agent. `seed_default_org()` runs in
  the FastAPI lifespan and is idempotent. Surfaced as the `OrgPage` —
  department cards with member chips and a head badge.
- **Goal ancestry** (`GoalRow` in `models.py`, `routes/goals.py`).
  Self-referential tree via `parent_goal_id`. Each task can be linked to a
  goal through `TaskRow.goal_id`. `/goals/tree/full` returns nested
  `{goal, children[], task_count}` nodes the `GoalsPage` renders with depth
  indentation.
- **Per-agent monthly budget** (`AgentBudgetRow`, `core/budget.py`).
  One row per `(agent_id, month=YYYY-MM)`. Functions: `set_agent_budget`,
  `record_agent_spend` (clamps spent_usd to limit_usd), `remaining_agent_budget`
  (returns `None` when `limit_usd == 0`, meaning "no cap"), `is_agent_exhausted`.
  The Hermes orchestrator gates every node in `_run_node_with_events`: if
  the agent is exhausted, it emits an `agent_budget_exhausted` event and
  returns an `AgentOutput(status="escalated", confidence=0.0)` without
  invoking the LLM. After a successful run it records the per-node cost via
  `asyncio.to_thread`. The `BudgetsPage` lets you set `limit_usd` per agent
  inline and shows a green/amber/red progress bar.

Dev SQLite databases benefit from a lightweight `ALTER TABLE` step inside
`init_db()` — `Base.metadata.create_all` only creates *missing tables*, so
the `_ensure_sqlite_columns()` helper adds `tasks.goal_id` to existing dev
DBs without forcing the user to drop `apps/api/data/app.db`. Production
Postgres should still use real migrations.

### Frontend

- `src/stores/useStore.ts` is the single Zustand store. Pages in `src/pages/` are thin views over it. Layout/sidebar in `src/components/`. Path alias `@` → `src/`.
- The frontend currently calls Gemini directly from the browser (see README security note). Treat it as a clickable prototype; production flows must go through `apps/api`.
- `chatWithFallback` (`src/lib/api.ts`) — if the backend returns 5xx/timeout it calls Gemini directly, writing `fallback_used: true` into the audit log.
- `sendUserMessageStream` in the store drives the SSE path; falls back to the buffered `sendUserMessage` if the stream errors mid-flight.
- `detectIntent` in the store does Turkish substring matching for supervisor commands (navigation, bulk approvals, brand/pricing regeneration, etc.) and short-circuits the backend call when a match is found.

### AI modality matrix

| Modality   | Provider / tool             | Entry point                                   |
|------------|-----------------------------|-----------------------------------------------|
| Text       | Gemini 2.5 Flash Lite       | `apps/api/core/llm/provider.py`               |
| Vision     | `image_analysis`            | `apps/api/tools/live/`                        |
| Image      | `brand_visual_generator`    | `apps/api/core/llm/image.py`                  |
| Live       | Voice Supervisor            | `apps/api/routes/voice.py` → `/ws/voice`      |
| Embedding  | pgvector memory             | `apps/api/core/memory/store.py`               |

The Live row is the WebSocket voice supervisor: client streams PCM, backend
forwards to Gemini Live (`gemini-2.0-flash-live-001`), transcripts are run
through a Turkish intent matcher (port of `detectIntent`), and matched
intents are dispatched to the Hermes orchestrator. Falls back to MockProvider
+ browser `SpeechRecognition` when `GEMINI_API_KEY` is absent.

### LLM provider

- `apps/api/core/llm/provider.py` exposes `get_llm_provider()` — returns Gemini if `GEMINI_API_KEY` is set, otherwise `MockProvider`. All orchestrator/agent code must go through this abstraction so tests run without network.
- `apps/api/core/llm/image.py` — Gemini image generation used by `brand_visual_generator`. Output saved to `apps/_images/` (gitignored).

### Memory layer

`apps/api/core/memory/store.py` provides pgvector cosine-similarity search used by the `memory_search` live tool. `embedding.py` wraps Gemini's embedding API. Requires a PostgreSQL instance with the `pgvector` extension — the tool degrades to mock if the connection is absent.

### Observability

`apps/api/core/observability/telemetry.py` sets up OpenTelemetry traces and Prometheus metrics. The observability stack (Prometheus + Grafana) is defined in `docker/compose.observability.yml` and is optional for local dev.

## Tests

`pytest-asyncio` is used; async tests are expected. Tests live in
`apps/api/tests/` and cover orchestration primitives (`test_task_graph.py`,
`test_router.py`), the tool layer (`test_openclaw.py`, `test_registry.py`),
autonomy primitives (`test_autonomy.py`), and a Hermes end-to-end suite
(`test_orchestrator.py`) that monkey-patches `get_llm_provider` to inject a
deterministic stub so the full `route → plan → run agents → merge` lifecycle
runs offline.

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
