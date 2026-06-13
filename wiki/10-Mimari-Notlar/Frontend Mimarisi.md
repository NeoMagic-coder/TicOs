# Frontend Mimarisi

**Konum:** `frontend/src/`

## Yapı
- `App.tsx` + `main.tsx` — entry.
- `pages/` — 17 sayfa. Bkz. [[Frontend Sayfalar]].
- `components/` — `Layout`, `Sidebar`, `ChatCommandBar`, `ChatMessageBody`, `ProductContextBar`, `SlashCommandMenu`, `SupervisorChatDock`, `VoiceDock` + `AOS/`, `onboarding/`.
- `stores/useStore.ts` — **tek Zustand store**. Sayfalar bunun üzerinde ince view.
- `lib/api.ts` — backend istemcisi. [[Frontend API Katmanı]].
- `types/`, `utils/`, `data/` — yardımcılar.

## Build
- Vite + React 19 + Tailwind.
- `vite.config.ts` → `vite-plugin-singlefile`. `npm run build` her şeyi tek HTML'e inliner.
- Path alias: `@` → `src/`.

## Önemli Notlar
- Frontend mevcut durumda Gemini'yi **doğrudan tarayıcıdan** çağırabiliyor (güvenlik notu README'de). Prototip; prod akışları backend'e gitmeli.
- E2E test: Playwright (`tests/e2e/`).
