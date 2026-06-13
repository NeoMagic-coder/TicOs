# Proje: Ajanlar Arası İletişim & Otonom Çalışma

**Durum:** Faz 1 + Faz 1.5 + Faz 2 implementasyonu tamamlandı — A2A bus genişletmesi / CoordinationBus birleşimi opsiyonel.
**Hedef:** Wiki'deki mevcut katmanların ([[Hermes Orkestratör]], [[Autonomy Layer]], [[Paperclip Layer]]) üzerine standart bir A2A (agent-to-agent) iletişim protokolü ve goal-driven otonom çalışma döngüsü kurmak.

---

## 🔍 Mevcut Durum (Wiki Analizi)

[[Hermes Orkestratör]]'deki `TaskGraph`, ajanları **statik 2 dalga** halinde koşturuyor: primary → supporting (depend primary). Ajanlar arası **aktif iletişim yok**; supporting ajanlar yalnızca primary'nin çıktısını bağlam olarak görüyor.

[[Autonomy Layer]] içinde `coordination.py` "agent-to-agent koordinasyon + capability matching" yapıyor fakat **API yüzeyi yok** — Hermes pipeline'ından çağrılabilir değil. `ontology.py` ortak sözlük tanımlıyor ama standart mesaj zarfı yok.

[[Paperclip Layer]]'da goal tree zengin (`parent_goal_id`, `task_count`) fakat goal'ler **kendi başına ajanları tetiklemiyor**. Otonom döngü kullanıcı isteğine bağlı — recurring background loop yok.

### Sonuç: 3 ana boşluk
1. **Inter-agent message bus yok** — pricing agent → logistics agent "fiyatı düşürdüm, stok hareketini izle" diyemiyor.
2. **Dinamik handoff yok** — ajan tool çağırır gibi başka ajana iş yollayamıyor; DAG runtime'da büyümüyor.
3. **Goal-driven otonom döngü** — `goal_loop.py` stale hedefleri tarar, Hermes dispatch + onay kuyruğu; scheduler `autonomy.goal_loop` (2s).

---

## 🏗️ Hedef Mimari (3 Bileşen)

### Bileşen A — Agent Message Bus (A2A Protocol) 🟢 FAZ 1
Standart `AgentMessage` zarfı + in-process asyncio pub/sub.

```python
AgentMessage(
    id: str,
    from_agent: str,
    to_agent: str | None,   # None → broadcast (intent-bazlı)
    intent: str,            # ontology'den: "request_data", "notify_event",
                            # "delegate_subtask", "negotiate_offer"
    payload: dict,
    correlation_id: str,    # request/goal/task'ı birbirine bağlar
    goal_id: int | None,    # [[Paperclip Layer]] goal tree linki
    created_at: datetime,
)
```

- `core/messaging/bus.py` → `MessageBus` (singleton, asyncio.Queue tabanlı).
- `publish(msg)`, `subscribe(agent_id, intent_filter)`, `history(correlation_id)`.
- Bellek-içi başlar; ileride DB persist'i opsiyonel.
- [[Observability]] standardına uyar: `messaging.published`, `messaging.delivered` log event'leri.

### Bileşen B — `agent_handoff` Tool 🟢 FAZ 1
[[OpenClaw Tool Layer]]'a yeni tool. Bir ajan başka ajana iş yollamak için bunu çağırır.

- Manifest: `autonomous_layer.json` içine eklenir.
- `allowed_agents`: autonomy 4'lüsü + `operations_agent`, `cmo_agent`, `cfo_agent` gibi koordinatör roller (genişletilebilir).
- `input_schema`: `to_agent`, `intent`, `payload`, opsiyonel `correlation_id`, `goal_id`.
- Live adapter: bus'a publish + DAG'a dinamik node injection (Faz 1'de sadece publish; DAG injection Faz 1.5).
- Permission + audit otomatik (OpenClaw zaten sarar).

### Bileşen C — Otonom Goal-Driven Loop ✅ FAZ 2 (uygulandı)
Background scheduler ([[Komutlar & Dev Akışı]]'ndaki `scheduler.py` üstüne).

- `core/autonomy/goal_loop.py` — stale goal tick (4s eşik, 30dk cooldown).
- Açık goal'leri ([[Paperclip Layer]] goal tree) tarar; Hermes orchestrator dispatch.
- Karar `decision_engine` policy gate'inden geçer:
  - `auto_approved` → task yaratır (`TaskRow.goal_id`), Hermes çalıştırır.
  - `needs_approval` → `/api/v1/approvals` kuyruğuna düşer (`params.goal_id`).
  - `escalated` (düşük güven) → aynı onay kuyruğu.
- Budget gate ve critic gate aynen geçerli ([[Hermes Orkestratör]] ile aynı runtime gate'ler).
- Route'lar: `GET /api/v1/autonomy/loop/status`, `POST /api/v1/autonomy/loop/tick`, `GET /api/v1/goals/overview`.
- Frontend: menubar OTONOM pill, GoalsPage tick, `refreshAllModules` + `maybeAutoGoalLoop`.

---

## 📋 Faz 1 İmplementasyon Planı (uygulanacak)

Wiki ve CLAUDE.md sayım/konvansiyonlarını koru.

### Yeni Dosyalar
1. `backend/apps/api/core/messaging/__init__.py`
2. `backend/apps/api/core/messaging/bus.py` — `AgentMessage` + `MessageBus`.
3. `backend/apps/api/tools/live/agent_handoff.py` — live adapter (bus'a publish).
4. `backend/apps/api/tests/test_messaging.py` — publish/subscribe + handoff smoke.

### Güncellenecek Dosyalar (mevcut!)
5. `backend/apps/api/tools/manifests/autonomous_layer.json` — `agent_handoff` manifest kaydı.
6. `backend/apps/api/main.py` — lifespan'da `register_live_adapter("agent_handoff", ...)`.

### Wiki Güncellemesi
7. `wiki/10-Mimari-Notlar/Agent Mesaj Veriyolu (A2A).md` — yeni node.
8. `wiki/İndeks.md` — yeni node link'i + sayım güncellemesi.

### Out-of-Scope (Faz 1'de yapılmaz)
- DAG'a dinamik node injection (mesaj alıcı ajanı [[Hermes Orkestratör]]'in mevcut planına eklemek).
- Background autonomous loop (Faz 2).
- Mesaj persist'i (DB tablosu).
- Frontend A2A timeline görselleştirmesi.

### Test Stratejisi
[[Test Stratejisi]] konvansiyonu (pytest-asyncio):
- `test_messaging.py::test_bus_publish_subscribe` — temel pub/sub.
- `test_messaging.py::test_message_history_by_correlation` — correlation lookup.
- `test_messaging.py::test_agent_handoff_tool` — adapter manifest'ten çağrılabiliyor mu (mock executor).

### Sayım Güncellemesi
- `Tool Manifest Registry`: 90 → **91 tool** (46 → 47 live).
- README + CLAUDE.md "Counts of record" satırı senkronize.

---

## ⚠️ Riskler & Karar Notları

- **Circular handoff:** A → B → A döngüsü olabilir. Faz 1'de `max_hops` (varsayılan 5) `correlation_id` üzerinden sayılır; aşıldıysa adapter `failure` döner.
- **Permission yetkisi:** `allowed_agents` listesi koordinatör ajanlarla başlar. Tüm ajanlara açmak prompt injection riski yaratır → tool description'da açıkça not edilir.
- **Mock vs Live:** `agent_handoff` her zaman live; deterministik (LLM yok). Test'lerde MessageBus singleton fixture ile reset edilir.
