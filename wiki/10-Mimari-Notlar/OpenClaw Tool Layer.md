# OpenClaw Tool Layer

**Konum:** `backend/apps/api/core/openclaw/`

Self-describing JSON manifest registry üzerinden tool çağrısı yapan, permission-scope'lu, JSON-schema validated, retry+fallback'li ve audit log'lu tool-use katmanı.

## Bileşenler
- `registry.py` → manifest loader; `is_allowed(agent_id, tool_id)` permission check.
- `executor.py` → `OpenClawExecutor.execute()`; permission + validation + retry + audit; `register_live_adapter()` ile live adapter inject edilir.
- `validator.py` → `jsonschema` ile `input_schema` doğrulaması.
- `breaker.py` → Circuit breaker; OPEN ise mock'a düşer ve payload'a `degraded: true` ekler.
- `mock_router.py` → `_CATEGORY_TEMPLATES` ile category-bazlı mock response.

## Yaşam Döngüsü
1. Agent → `executor.execute(tool_id, payload, ctx)`.
2. Permission check (`allowed_agents`).
3. Input schema validation; başarısız → `ToolExecutionResult(status="failure")`.
4. Live mode + adapter varsa → adapter çalıştırılır (breaker sarmalı).
5. Mock mode veya breaker OPEN → `mock_router` template'i.
6. Her çağrı `ExecutionContext.audit`'e eklenir → response'taki `tools_used` buradan üretilir.

## İlgili
- [[Tool Manifest Registry]] — manifest dosyaları + sayım.
- [[Hermes Orkestratör]] — çağıran taraf.
