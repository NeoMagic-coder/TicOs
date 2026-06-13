# Test Stratejisi

## Backend — pytest-asyncio
**Konum:** `backend/apps/api/tests/`

- `test_task_graph.py` — DAG primitives.
- `test_router.py` — agent seçimi.
- `test_openclaw.py` — permission + schema validation + breaker.
- `test_registry.py` — manifest sayım/filtre.
- `test_autonomy.py` — [[Autonomy Layer]] decision engine.
- `test_orchestrator.py` — Hermes E2E. `get_llm_provider`'ı monkey-patch ile deterministik stub'a bağlar → networksüz tam lifecycle.

## Frontend — Playwright
**Konum:** `frontend/tests/e2e/`, config `frontend/playwright.config.ts`.
Kurulum için bkz. [[Komutlar & Dev Akışı]].

## Yeni Test Eklerken
- Yeni ajan → router + orchestrator testi (CLAUDE.md "Adding an agent" worked example).
- Yeni tool → registry + openclaw permission/schema testi.
