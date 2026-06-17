# Environment & API Keys

**Konum:** `backend/.env.local` (gitignored), `frontend/.env.local` (opsiyonel UI ipuçları).

## Backend (zorunlu / önerilen)

```env
# Metin: Hermes + ajan çağrıları (önerilen)
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-2.5-flash-lite

# Görsel, Vision, Voice, embedding (Gemini-native)
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash
```

- `LLM_PROVIDER` yoksa veya OpenRouter başarısızsa `GEMINI_API_KEY` ile metin fallback mümkün.
- Anahtar yoksa `MockProvider` devreye girer; test ve offline akışlar çalışır.

## Frontend

- LLM anahtarı bundle'a **gömülmez** — tüm tamamlamalar `POST /api/v1/llm/generate` proxy üzerinden.
- `VITE_GEMINI_MODEL` yalnızca UI'da model adı göstermek için (opsiyonel).
- Tarayıcı fallback: `import.meta.env.DEV || VITE_ENABLE_BROWSER_LLM_FALLBACK` ile sınırlı.

## Sorun Giderme

- "API key not valid" + `.env.local` doğruysa: stale sistem env gölgeleyebilir (`GEMINI_API_KEY` temizle, backend'i yeniden başlat).
- Üretim: `API_KEY` reverse proxy'de; tarayıcı bundle'ında değil.

## İlgili

- [[LLM Provider Layer]], [[Komutlar & Dev Akışı]], [[Frontend API Katmanı]].
