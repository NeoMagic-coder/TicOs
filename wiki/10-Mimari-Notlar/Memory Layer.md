# Memory Layer

**Konum:** `backend/apps/api/core/memory/`

- `store.py` → pgvector cosine similarity search. `memory_search` ve `knowledge_search` live tool'ları tarafından kullanılır.
- `embedding.py` → Gemini embedding API wrapper.

## Gereksinim
Postgres + `pgvector` extension. Bağlantı yoksa `memory_search` tool'u mock'a düşer (`degraded: true`).

## İlgili
- [[Tool Manifest Registry]] → `memory.json` manifest dosyası.
- [[LLM Provider Layer]] → embedding sağlayıcısı.
