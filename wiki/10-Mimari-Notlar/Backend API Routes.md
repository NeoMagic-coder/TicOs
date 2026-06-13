# Backend API Routes

**Konum:** `backend/apps/api/routes/` — `main.py` içinde register edilir. OpenAPI docs: `http://localhost:8000/docs`.

## Çekirdek
- `GET  /health`
- `POST /api/v1/chat` — Hermes buffered. [[Hermes Orkestratör]].
- `POST /api/v1/chat/stream` — SSE. Bkz. [[SSE & Voice Streaming]].
- `WS   /ws/voice` — Voice Supervisor.

## Agents & Tools
- `GET /api/v1/agents`, `GET /api/v1/agents/{id}`
- `GET /api/v1/tools` (`?category=&agent_id=`), `GET /api/v1/tools/{id}`
- `POST /api/v1/tools/execute` — tek tool çağrısı, permission-checked.

## Tasks & Approvals
- `GET/POST /api/v1/tasks`
- `GET /api/v1/approvals`
- `POST /api/v1/approvals/{id}/{approve|reject}`
- `POST /api/v1/approvals/{id}/estimate` — LLM expected impact.

## Paperclip
- `GET /api/v1/org/units`, `GET /api/v1/org/units/{id}`, `GET /api/v1/org/agents/{id}/unit`
- `GET/POST /api/v1/goals`, `GET/PATCH/DELETE /api/v1/goals/{id}`
- `GET /api/v1/goals/{id}/ancestors`, `GET /api/v1/goals/tree/full`
- `GET /api/v1/agents/budgets`
- `GET/PUT /api/v1/agents/{id}/budget`

## Diğer Route Modülleri (mevcut)
`brand.py`, `pricing.py`, `products.py`, `dashboard.py`, `audit/automations.py`, `demo.py`, `graph.py`, `grounding.py`, `growth.py`, `integrations.py`, `knowledge.py`, `llm.py`, `policies.py`, `research.py`, `rpc.py`, `scheduler.py`, `skills.py`, `webhooks.py`.

## İlgili
- [[Frontend API Katmanı]] — istemci tarafı.
