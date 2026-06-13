# Proje Genel Bakış

**OneProduct Agent OS**, tek bir ürün etrafında dönen çok-ajanlı e-ticaret platformudur. İki kooperatif katman üzerine kurulu: orkestrasyon ([[Hermes Orkestratör]]) ve tool-use ([[OpenClaw Tool Layer]]). Frontend Vite+React 19 SPA, backend FastAPI; ikisi de bağımsız çalışabilir (frontend Gemini'yi doğrudan tarayıcıdan çağırabilir).

## Stack
- **Backend:** FastAPI, SQLAlchemy, Pydantic, pytest-asyncio. Dizin: `backend/apps/api/`.
- **Frontend:** Vite, React 19, Zustand, Tailwind, Playwright e2e. Dizin: `frontend/src/`.
- **LLM:** Gemini 2.5 Flash Lite (text), Gemini Image, Gemini Live (voice). Bkz. [[LLM Provider Layer]].
- **DB:** SQLite (dev), Postgres + pgvector (prod). Bkz. [[Memory Layer]].
- **Dil:** Tüm UI ve agent prompt'ları **Türkçe**.

## Üst Seviye Akış
1. Kullanıcı isteği → `POST /api/v1/chat` → [[Hermes Orkestratör]].
2. Router → primary + supporting agent seçer.
3. `TaskGraph` paralel `asyncio.gather` ile çalışır.
4. Her ajan [[OpenClaw Tool Layer]] üzerinden tool çağırır.
5. CriticAgent skorlar → düşükse retry/escalate.
6. LLM tabanlı Türkçe executive summary ile merge.

## Sayım Referansı (CLAUDE.md ile senkron)
- 22 ajan spec/class, 5 org birimi, 16 manifest, 90 tool (46 live + 44 mock).
- Detay: [[Agent Katmanı]], [[Tool Manifest Registry]].
