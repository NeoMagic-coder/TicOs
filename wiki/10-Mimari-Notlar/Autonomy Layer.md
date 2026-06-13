# Autonomy Layer

**Konum:** `backend/apps/api/core/autonomy/`

Yüksek-güvenli otonom aksiyonlar için policy-gated karar katmanı. 4 ajan ([[Agent Katmanı]] otonom blok) bu modülleri her karar için LLM çağırmak yerine doğrudan kullanır.

## Modüller
- `decision_engine.py` — `AutonomyPolicy` thresholds: `max_price_change_pct`, `max_carrier_switch_cost_try`, `min_confidence`, `risk_auto_threshold`. Çıktılar: `auto_approved` / `needs_approval` / `rejected`. Deterministik, side-effect yok.
- `negotiation.py` — `NegotiationAgent` ile karşı taraf arasında çok turlu pazarlık protokolü.
- `coordination.py` — Agent-to-agent koordinasyon + capability matching.
- `goals.py` — `autonomous_decision_agent` için hedef decomposition.
- `marketplace_router.py` — Otonom aksiyonu doğru marketplace adapter'a route'lar.
- `ontology.py` — Cross-agent shared domain vocabulary.

## İlgili Tool'lar
- `autonomy_policy_check` (compute_tools içinde) — policy gate'i tool olarak çağırır.

## İlgili Wiki
- [[Agent Katmanı]] — 4 otonom ajan.
- [[Onay Akışı]] — `needs_approval` kararları `/api/v1/approvals` üzerinden manuel onaya gider.
