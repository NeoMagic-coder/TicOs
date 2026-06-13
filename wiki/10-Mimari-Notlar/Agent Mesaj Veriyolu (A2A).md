# Agent Mesaj Veriyolu (A2A)

**Konum:** `backend/apps/api/core/messaging/` + tool `backend/apps/api/tools/live/agent_handoff.py`

Standart **agent-to-agent** iletişim katmanı. [[Hermes Orkestratör]]'ün statik DAG'ı dışında, ajanların runtime'da birbirine mesaj yollamasını sağlar.

## Bileşenler
- `bus.py:AgentMessage` — `from_agent`, `to_agent` (None → broadcast), `intent`, `payload`, `correlation_id`, `goal_id`, `hop`, `id`, `created_at`. Geçersiz intent/empty `from_agent` → `MessageBusError`.
- `bus.py:MessageBus` — asyncio singleton. `publish` / `subscribe(agent_id?, intent?)` / `history(correlation_id|agent_id)` / `reset()`.
- `bus.py:get_message_bus()` — süreç ömürlü singleton accessor.
- `agent_handoff` tool — [[OpenClaw Tool Layer]]'a live adapter olarak kaydedilir; `with_breaker` sarmalı.
- `coordination_bridge.py` — `CoordinationBus.publish` → A2A `MessageBus` relay (`get_coordination_bus()` ile otomatik).

## Mesaj Zarfı (intent enum'u)
- `request_data` — başka ajandan veri iste.
- `notify_event` — broadcast/yönlendirilmiş olay duyurusu (örn. fiyat düştü).
- `delegate_subtask` — alt görev devri.
- `negotiate_offer` — [[Autonomy Layer]] `negotiation.py` ile entegre pazarlık adımı.

## Döngü Koruması
`MAX_HOPS = 5`. Her relay'de `hop` bir artar; aşıldığında adapter `{status: "failure", reason: "max_hops_exceeded"}` döner ve bus'a publish etmez. Aynı `correlation_id` zincirini `bus.history(correlation_id=...)` ile çekersin.

## Permission
`allowed_agents` manifest'te kısıtlı: `negotiation_agent`, `logistics_agent`, `dynamic_pricing_agent`, `autonomous_decision_agent`, `operations_agent`, `supervisor`. Tüm ajanlara açmak prompt-injection riski yaratır — gerektikçe genişlet.

## Test
`backend/apps/api/tests/test_messaging.py` — pub/sub fan-out, agent_id/intent filtreleri, correlation history, geçersiz intent, handler hatasında izolasyon, executor üzerinden tool çağrısı, max_hops kill-switch.

## Plan & Faz Bilgisi
Detaylı plan + Faz 2/3 önerileri: [[Agent-Iletisim-ve-Otonom-Calisma]] (`20-Projeler/`).

## İlgili
- [[OpenClaw Tool Layer]] — tool sarmalı.
- [[Autonomy Layer]] — `coordination.py` ileride bu bus üzerine taşınabilir.
- [[Hermes Orkestratör]] — `handoff_bridge.py` ile `delegate_subtask` → DAG node injection (Faz 1.5 ✅).
- [[Tool Manifest Registry]] — sayım: 91 tool (47 live + 44 mock).
