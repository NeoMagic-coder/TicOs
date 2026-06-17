# Frontend API Katmanı

**Konum:** `frontend/src/lib/api.ts` + `frontend/src/lib/gemini.ts` + `frontend/src/stores/useStore.ts`

## Anahtar Fonksiyonlar
- `chatWithFallback` — backend 5xx/timeout dönerse (dev/fallback flag açıksa) `/api/v1/llm/generate` veya sınırlı tarayıcı fallback; audit log'a `fallback_used: true`.
- `sendUserMessageStream` (store) — SSE pipeline'ı sürer; mid-flight hata → buffered `sendUserMessage`.
- `detectIntent` (store) — Türkçe substring matcher; supervisor komutları (navigation, bulk approvals, brand/pricing regen) için backend çağrısını **short-circuit** eder.

## Tasarım Felsefesi
- Prod akışı: Hermes backend (`/api/v1/chat`, `/api/v1/chat/stream`).
- LLM proxy: `gemini.ts` → backend `POST /api/v1/llm/generate` (anahtar sunucuda).
- Tüm sayfalar tek store'dan veri okur, action'ları aynı yere yazar → state senkron.

## İlgili
- [[Backend API Routes]], [[SSE & Voice Streaming]], [[Hermes Orkestratör]], [[Environment & API Keys]].
