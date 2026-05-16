# OneProduct Agent OS

**Bir ürün. Tüm e-ticaret. Tamamen otonom.**

Tek ürün etrafında **22 uzman ajan + 65 tool manifesti** ile uçtan uca e-ticaret operasyonunu yöneten, **Hermes orkestrasyon + OpenClaw tool-use** mimarisi üzerine kurulu bir multi-agent platform. Frontend tıklanabilir, backend ise gerçek bir Hermes + OpenClaw çalıştırır.

> Sayılar repo gerçeğiyle eşittir: `apps/api/agents/specialized.py` içinde 22 ajan sınıfı (4'ü multi-agent otonomi katmanı: negotiation / logistics / dynamic_pricing / autonomous_decision), `apps/api/tools/manifests/` altında 12 JSON dosyası ve 65 manifest kaydı bulunur. Tool'ların büyük çoğunluğu hâlâ **mock** modundadır. Live adaptörler: `brand_visual_generator` (Gemini image), `memory_search` (pgvector cosine), `shopify_store_setup` / `shopify_get_orders` / `shopify_update_inventory` (Shopify Admin REST, pybreaker circuit-breaker ile sarmalı, credentials yoksa mock'a düşer). Meta/Google Ads, Klaviyo, Trendyol/Trustpilot ve image-gen fallback'ı Faz 2 stub'ları olarak `apps/api/tools/live/` altında bekliyor.

## Mimari

İki kooperatif katman:

- **Hermes (orkestrasyon)** — `apps/api/core/hermes/`. CEO Agent talebi parse eder, DAG kurar, alt ajanlara dağıtır, sonuçları birleştirir.
- **OpenClaw (tool-use)** — `apps/api/core/openclaw/`. Self-describing JSON manifest registry, permission-scoped çağrı, sandbox + retry + fallback + audit log + cost tracking.

```
apps/
  api/                      # FastAPI backend (Python)
    core/
      hermes/               # orchestrator, task_graph, router
      openclaw/             # registry, executor, validator, mock_router
      llm/                  # provider (Gemini + mock)
    agents/                 # 22 specialized agents (incl. multi-agent autonomy layer)
    tools/manifests/        # JSON tool manifests
    routes/                 # chat, agents, tools, tasks, approvals
    tests/                  # pytest
src/                        # Vite + React 19 + Tailwind v4 frontend
docs/whitepaper/            # LaTeX paper + BibTeX refs
scripts/                    # bash dev/build/check
flake.nix                   # reproducible dev shell
```

## Hızlı başlangıç

```bash
# Frontend (tek başına çalışır, Gemini doğrudan tarayıcıdan çağrılır)
npm install
npm run dev          # http://localhost:5173

# Backend (opsiyonel — Hermes orkestratörü, real DAG, tool registry)
pip install -r apps/api/requirements.txt
uvicorn apps.api.main:app --reload --port 8000   # http://localhost:8000/docs

# İkisi birden
scripts/dev.sh

# Nix kullanıyorsan
nix develop
```

### Çevre değişkenleri

`.env.local` dosyası (gitignore'da):

```
VITE_GEMINI_API_KEY=AIza...     # frontend
VITE_GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_KEY=AIza...           # backend
GEMINI_MODEL=gemini-2.5-flash
```

Anahtar olmadan: frontend uyarı verir; backend MockProvider'a düşer, akış çalışmaya devam eder.

## Backend API

```
GET    /health
POST   /api/v1/chat              # Hermes orkestrasyon — DAG + merge
GET    /api/v1/agents
GET    /api/v1/agents/{id}
GET    /api/v1/tools             # ?category= ?agent_id=
GET    /api/v1/tools/{id}
POST   /api/v1/tools/execute     # tek bir tool çağrısı, permission check'li
GET    /api/v1/tasks
POST   /api/v1/tasks
GET    /api/v1/approvals
POST   /api/v1/approvals/{id}/{approve|reject}
```

OpenAPI dokümantasyonu: `http://localhost:8000/docs`

## Whitepaper

`docs/whitepaper/` altında mimariyi anlatan LaTeX makale. Derleme:

```bash
make -C docs/whitepaper
# → docs/whitepaper/paper.pdf
```

## Test ve doğrulama

```bash
scripts/check.sh        # tsc + vite build + pytest
pytest apps/api/tests   # sadece backend
```

## Diller

- **Python** — Hermes orchestrator, OpenClaw executor, FastAPI, 18 ajan, tool manifests, tests
- **TypeScript** — React frontend, Zustand store, Gemini client
- **TeX + BibTeX** — mimari whitepaper + akademik referanslar (`oneproduct.bst` özel stil)
- **Shell** — `scripts/dev.sh`, `build.sh`, `check.sh`, `seed_api.sh`
- **Nix** — `flake.nix` ile reproducible dev environment

## Güvenlik notu

LLM API anahtarı frontend bundle'da görünür biçimde paketlenir — bu sadece **lokal prototip** için uygundur. Production için backend proxy (`apps/api`) üzerinden gitmelisiniz; backend anahtarı asla browser'a göndermez.

## Lisans

MIT.
