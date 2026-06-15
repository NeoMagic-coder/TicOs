# TicOs 🦞



 

**TicOs** (TicOsClaw), tek ürün etrafında dönen e-ticaret operasyonlarını otonom ajan iş akışlarına dönüştüren çoklu-ajan yapay zeka işletim sistemidir. Hermes orkestratörü, OpenClaw araç katmanı, otonomi modülü ve TIC (sipariş/envanter) entegrasyonu ile pazar analizi, fiyatlandırma, stok, pazarlama ve müşteri operasyonlarını tek panelden yönetir.

---

## 📌 Problem ve Çözüm

### Problem
E-ticaret verileri pazar analizi, rakip takibi, stok, müşteri geri bildirimleri ve pazarlama kanallarına dağılmış durumda. İnsan yönetimli süreçler gecikme, yanlış fiyatlandırma ve kaçırılan trendlere yol açar.

### Çözüm
TicOs, dağınık süreçleri otonom iş akışlarına dönüştürür: 22 uzman ajan, 98 araç manifesti, policy-gated otonomi katmanı ve canlı SSE/voice supervisor ile 7/24 optimize operasyon sağlar.

---

## 🏗️ Mimari

```
Kullanıcı / API / Voice / Extension
           │
           ▼
    Hermes Orkestratör ──► TaskGraph (DAG) ──► Ajanlar (22)
           │                                      │
           │                                      ▼
           │                              OpenClaw Executor
           │                              (izin + şema + audit)
           ▼                                      │
    Türkçe özet birleştirme ◄─────────────────────┘
           │
           ├── Autonomy Layer (policy, negotiation, goal loop)
           ├── Shopping Agent (Trendyol / Hepsiburada crawler)
           ├── TIC Modülü (sipariş, envanter, müşteri)
           ├── AutoResearch (parametre optimizasyon döngüsü)
           └── Paperclip (org chart, hedefler, bütçe)
```

| Katman | Görev |
|--------|-------|
| **Hermes** | İstek yönlendirme, DAG planlama, paralel ajan çalıştırma, Türkçe özet |
| **OpenClaw** | JSON manifest registry, izin kontrolü, schema validation, retry/fallback |
| **Autonomy** | Policy-gated kararlar, müzakere, koordinasyon, marketplace router |
| **Shopping** | Web arama + crawler ile ürün keşfi ve fiyat karşılaştırma |
| **TIC** | Sipariş, envanter ve müşteri CRUD + dashboard rollup |
| **Frontend** | Vite + React 19 SPA — tüm LLM trafiği backend proxy üzerinden |

---

## 🛠️ Teknoloji Yığını

| Bileşen | Teknoloji |
|---------|-----------|
| Backend | Python 3.11+, FastAPI, SQLAlchemy, asyncio |
| Frontend | Vite, React 19, Zustand, TypeScript |
| LLM | OpenRouter (metin) + Gemini (görsel, vision, voice, embedding) |
| Veritabanı | SQLite (dev), PostgreSQL + pgvector (prod) |
| Test | pytest, Playwright |
| Dağıtım | Docker Compose, nginx reverse proxy |

### Kayıt Sayıları

- **22 ajan** — seed registry (4 tanesi otonomi katmanı)
- **98 araç manifesti** — 57 live, 41 mock
- **5 org birimi** — yönetim, pazarlama, operasyon, finans, AR-GE

---

## ⚙️ Kurulum ve Çalıştırma

Proje **backend** (FastAPI, port 8000) ve **frontend** (Vite + React, port 5173) olmak üzere iki bölümden oluşur.

### Ön Koşullar

- Python 3.11+
- Node.js 18+ (LTS)
- Git
- Metin çağrıları için **OpenRouter** veya **Gemini API Key**
- Görsel, Vision, Voice ve embedding için **Gemini API Key**

### 1. Depoyu Klonla

```bash
git clone https://github.com/NeoMagic-coder/TicOs.git
cd TicOs
```

### 2. Ortam Değişkenleri

`backend/.env.local` dosyasını oluştur:

```env
# Önerilen: metin tabanlı Hermes ve ajan çağrıları OpenRouter üzerinden
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-2.5-flash-lite

# Gemini-native görsel, Vision, Voice ve embedding akışları
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash

# Frontend'e LLM anahtarı gerekmez — tüm çağrılar backend /api/v1/llm/generate
# proxy'sinden geçer. VITE_GEMINI_MODEL yalnızca UI'da model adı göstermek için.
VITE_GEMINI_MODEL=gemini-2.5-flash
```

OpenRouter çağrıları varsayılan olarak ZDR, veri toplama reddi, fiyat tavanı ve düşük gecikme tercihiyle yönlendirilir. Geçici OpenRouter arızalarında `GEMINI_API_KEY` tanımlıysa metin çağrıları Gemini'ye düşer.

### Google OAuth Girişi

OAuth varsayılan olarak kapalıdır; açıldığında uygulama kabuğu ve `/api/v1/*` uçları
imzalı, süreli `HttpOnly` oturum çerezi gerektirir. Google Cloud Console'da
**Web application** OAuth istemcisi oluşturun ve yerel geliştirme için şu
yönlendirme URI'sini ekleyin:

```text
http://localhost:8000/api/v1/auth/callback
```

Ardından `backend/.env.local` dosyasına ekleyin:

```env
AUTH_ENABLED=true
AUTH_SESSION_SECRET=replace-with-at-least-32-random-characters
GOOGLE_OAUTH_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/api/v1/auth/callback
FRONTEND_URL=http://localhost:5173

# İsteğe bağlı: yalnızca belirtilen Google Workspace alan adlarına izin ver.
OAUTH_ALLOWED_EMAIL_DOMAINS=["example.com"]
```

Güçlü bir oturum sırrı üretmek için:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Üretimde callback ve frontend adreslerini HTTPS kullanacak şekilde değiştirin ve
`AUTH_COOKIE_SECURE=true` bırakın.

---

### 🍎 macOS

```bash
brew install python@3.12 node git

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r apps/api/requirements.txt
uvicorn apps.api.main:app --reload --port 8000
```

Yeni terminal:

```bash
cd frontend && npm install && npm run dev
```

Veya repo kökünden:

```bash
scripts/dev.sh
```

---

### 🐧 Linux (Ubuntu / Debian)

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nodejs npm git

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r apps/api/requirements.txt
uvicorn apps.api.main:app --reload --port 8000
```

Yeni terminal: `cd frontend && npm install && npm run dev`

> Eski dağıtımlarda Node sürümü düşükse [NodeSource](https://github.com/nodesource/distributions) veya `nvm` kullanın.

---

### 🪟 Windows (PowerShell)

```powershell
winget install Python.Python.3.12
winget install OpenJS.NodeJS.LTS
winget install Git.Git

cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r apps\api\requirements.txt
uvicorn apps.api.main:app --reload --port 8000
```

Yeni pencere: `cd frontend && npm install && npm run dev`

> `Activate.ps1` engellenirse: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`
>
> Stale env uyarısı: `Remove-Item Env:GEMINI_API_KEY`

---

### Erişim

| Servis | URL |
|--------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| Swagger Docs | http://localhost:8000/docs |

### Testler

```bash
# Backend (backend/ dizininden)
pytest apps/api/tests -q

# Frontend E2E (frontend/ dizininden)
npx playwright install chromium
npm run test:e2e

# Tam doğrulama
scripts/check.sh
```

### Üretim Dağıtımı

```bash
cp docker/.env.prod.example docker/.env.prod
# Parolaları, API_KEY ve PUBLIC_HOST değerini değiştirin.
docker compose --env-file docker/.env.prod -f docker/compose.prod.yml up -d --build
```

`API_KEY` tarayıcı bundle'ına gömülmez; reverse proxy tarafından sunucu tarafında eklenir. Yatay ölçeklemede yalnızca bir süreç `SCHEDULER_ENABLED=true` kullanmalıdır.

---

## 📦 Proje Yapısı

```
TicOs/
├── backend/apps/api/     # FastAPI — Hermes, OpenClaw, ajanlar, araçlar
├── frontend/             # Vite + React SPA
├── extension/            # Chrome extension (ürün sayfası entegrasyonu)
├── ticos/                # Next.js TIC dashboard (Prisma)
├── docker/               # Compose + Dockerfile'lar
├── raw/                  # Değişmez ham kaynaklar (LLM Wiki)
├── wiki/                 # Obsidian vault — mimari notlar + LLM Wiki
├── START HERE.md         # Obsidian vault hızlı başlangıç
└── scripts/              # dev.sh, check.sh, deploy
```

Obsidian'da vault olarak repo kökünü açın. Agent şeması: `wiki/LLM-WIKI-AGENTS.md`.

---

## 🤝 Katkıda Bulunma

1. Depoyu fork edin
2. Dal oluşturun: `git checkout -b feature/AmazingFeature`
3. Commit: `git commit -m 'Add some AmazingFeature'`
4. Push: `git push origin feature/AmazingFeature`
5. Pull Request açın

---

## 📄 Lisans

Bu proje MIT Lisansı altındadır. Detaylar için [LICENSE](LICENSE) dosyasına bakın.
