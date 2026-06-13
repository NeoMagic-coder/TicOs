# Agent Katmanı

**Konum:** `backend/apps/api/agents/`

## Yapı
- `base.py` → `BaseAgent.run()` + sistem promptu skeleton.
- `seed.py` → `SEED_AGENTS` listesi (22 spec).
- `specialized.py` → 22 concrete class + `AGENT_CLASSES` map. **Hiçbir ajan `GenericAgent` fallback'ine düşmüyor.**
- `critic.py` → [[Critic Agent]].
- `registry.py` → runtime registry.

## 22 Ajan
Tüm ajanlar Türkçe rol prompt'una sahip. `AGENT_CLASSES` map'inde id → class eşlemesi yapılır; yeni ajan eklenirken **mutlaka** bu map güncellenmeli (yoksa `GenericAgent` devreye girer ve özel prompt kaybolur).

## Autonomy Ajanları (4)
`negotiation_agent`, `logistics_agent`, `dynamic_pricing_agent`, `autonomous_decision_agent` — bunlar her karar için LLM çağırmak yerine [[Autonomy Layer]] modüllerini kullanır.

## Yeni Ajan Ekleme (5 adım)
1. `seed.py` → `_spec(...)` ekle.
2. `specialized.py` → `BaseAgent` türevi class.
3. `AGENT_CLASSES`'a id → class kaydı.
4. `router.py` → `_KEYWORDS` tablosuna Türkçe kök kelimeler.
5. Test: `test_router.py` + `test_orchestrator.py`.

> Detaylı worked example için CLAUDE.md "Adding an agent" bölümüne bak.

## İlgili
- [[Hermes Orkestratör]], [[Tool Manifest Registry]], [[Autonomy Layer]], [[Critic Agent]].
