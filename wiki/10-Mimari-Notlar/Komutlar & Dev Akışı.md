# Komutlar & Dev Akışı

> Backend komutları `backend/` dizininden, frontend komutları `frontend/` dizininden çalıştırılır.

## Dev Sunucular
```bash
# Frontend (http://localhost:5173)
cd frontend && npm install && npm run dev

# Backend (http://localhost:8000, /docs)
cd backend && pip install -r apps/api/requirements.txt
cd backend && uvicorn apps.api.main:app --reload --port 8000

# İkisi birden
scripts/dev.sh

# Nix shell
nix develop
```

## Kontrol & Test
```bash
scripts/check.sh        # tsc --noEmit + vite build + pytest

# Sadece backend
cd backend && pytest apps/api/tests -q

# Tek test
pytest apps/api/tests/test_task_graph.py::test_name -q

# Seed
scripts/seed_api.sh

# Whitepaper
make -C docs/whitepaper
```

## Playwright İlk Kurulum
```bash
cd frontend
npm install
npx playwright install chromium
npm run test:e2e
```

`webServer.command = "npm run dev"` → Vite otomatik boot olur.

## İlgili
- [[Test Stratejisi]], [[Environment & API Keys]].
