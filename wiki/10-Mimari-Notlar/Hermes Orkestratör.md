# Hermes Orkestratör

**Konum:** `backend/apps/api/core/hermes/`

Kullanıcı isteğini parse edip bir `TaskGraph` kuran, hazır node'ları `asyncio.gather` ile paralel çalıştıran ve sonuçları LLM tabanlı Türkçe executive summary ile birleştiren orkestrasyon katmanı.

## Bileşenler
- `orchestrator.py` → `HermesOrchestrator.handle()` ana giriş.
- `router.py` → `LLMRouter.route()`: primary + supporting agent seçer; LLM başarısız olursa Türkçe keyword tablosuna düşer (`_KEYWORDS`).
- `TaskGraph` → supporting node'lar primary'ye depend; primary bitince ikinci dalga koşar.

## Request Lifecycle
1. `handle()` çağrılır.
2. `router.route()` → agent seçimi.
3. `_plan()` → `TaskGraph` kurulur.
4. `_run_node_with_events()` her node için: [[Per-Agent Budget Gate]] kontrolü, `BaseAgent.run()`, [[OpenClaw Tool Layer]] çağrıları, [[Critic Agent]] skoru.
5. `_merge()` → Türkçe executive summary; LLM hata verirse bulleted digest fallback.
6. `escalated` flag'i: confidence `orchestrator_low_confidence_threshold` altındaysa veya critic skoru `critic_min_score` altındaysa set edilir.

## SSE Varyantı
`POST /api/v1/chat/stream` aynı pipeline; her adımda `progress` event yayar (`task_started`, `plan_ready`, `agent_started`, `tool_called`, `critic_scored`, `agent_retry`, `agent_completed`, `merging`). Bkz. [[SSE & Voice Streaming]].

## İlgili
- [[Agent Katmanı]] — ajan tarafı.
- [[OpenClaw Tool Layer]] — tool tarafı.
- [[Critic Agent]] — kalite gate'i.
