# Frontend API Katmanı

**Konum:** `frontend/src/lib/api.ts` + `frontend/src/stores/useStore.ts`

## Anahtar Fonksiyonlar
- `chatWithFallback` — backend 5xx/timeout dönerse Gemini'yi tarayıcıdan doğrudan çağırır; audit log'a `fallback_used: true` yazar.
- `sendUserMessageStream` (store) — SSE pipeline'ı sürer; mid-flight hata → buffered `sendUserMessage`.
- `detectIntent` (store) — Türkçe substring matcher; supervisor komutları (navigation, bulk approvals, brand/pricing regen) için backend çağrısını **short-circuit** eder.

## Tasarım Felsefesi
- Backend prod akışı; frontend Gemini fallback'i sadece prototip için.
- Tüm sayfalar tek store'dan veri okur, action'ları aynı yere yazar → state senkron.

## İlgili
- [[Backend API Routes]], [[SSE & Voice Streaming]], [[Hermes Orkestratör]].
