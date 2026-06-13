# Critic Agent

**Konum:** `backend/apps/api/agents/critic.py`

Her agent çıktısını 3 eksende 0.0–1.0 arası puanlar:
1. **Concreteness** — somut, eyleme dökülebilir ifadeler.
2. **Numeric grounding** — sayısal temellendirme.
3. **Hallucination risk** — uydurma riski (ters skor).

## Karar Mantığı
- Toplam skor `critic_min_score` altında → bir kez **retry**.
- Hâlâ düşükse → `escalated` flag'i ile döner.
- LLM hatası → deterministik heuristic fallback (regex tabanlı).

## Lifecycle Konumu
[[Hermes Orkestratör]] içinde her `_run_node_with_events()` çağrısının sonunda devreye girer; SSE pipeline'ında `critic_scored` ve gerekirse `agent_retry` event'leri yayar.
