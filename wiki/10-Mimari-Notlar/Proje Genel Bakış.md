# Proje Genel Bakış

**TicOs** (TicOsClaw), tek bir ürün etrafında dönen çok-ajanlı e-ticaret platformudur. İki kooperatif katman üzerine kurulu: orkestrasyon ([[Hermes Orkestratör]]) ve tool-use ([[OpenClaw Tool Layer]]). Frontend Vite+React 19 SPA, backend FastAPI; tüm LLM trafiği backend proxy üzerinden (`/api/v1/llm/generate`).

## Stack
- **Backend:** FastAPI, SQLAlchemy, Pydantic, pytest-asyncio. Dizin: `backend/apps/api/`.
- **Frontend:** Vite, React 19, Zustand, Tailwind, Playwright e2e. Dizin: `frontend/src/`.
- **LLM:** OpenRouter (metin, önerilen) + Gemini (görsel, vision, voice, embedding). Bkz. [[LLM Provider Layer]].
- **DB:** SQLite (dev), Postgres + pgvector (prod). Bkz. [[Memory Layer]].
- **Ek modüller:** Shopping agent (`shopping/`), TIC dashboard (`ticos/`), Chrome extension (`extension/`).
- **Dil:** Tüm UI ve agent prompt'ları **Türkçe**.

## Üst Seviye Akış
1. Kullanıcı isteği → `POST /api/v1/chat` → [[Hermes Orkestratör]].
2. Router → primary + supporting agent seçer.
3. `TaskGraph` paralel `asyncio.gather` ile çalışır.
4. Her ajan [[OpenClaw Tool Layer]] üzerinden tool çağırır.
5. CriticAgent skorlar → düşükse retry/escalate.
6. LLM tabanlı Türkçe executive summary ile merge.

## Sayım Referansı (README / AGENTS.md ile senkron)
- 22 ajan spec/class (4 tanesi otonomi katmanı), 5 org birimi, 17 manifest, 98 tool (57 live + 41 mock).
- Detay: [[Agent Katmanı]], [[Tool Manifest Registry]].

## Obsidian LLM Wiki
- Proje mimarisi: bu indeks + `10-Mimari-Notlar/`.
- Dış kaynaklar: `raw/` + `wiki/index.md` — bkz. [[LLM-WIKI-AGENTS]].
