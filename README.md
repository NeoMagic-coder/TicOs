# OneProduct-Agent-OS 🚀
 <img width="2752" height="1536" alt="unnamed" src="https://github.com/user-attachments/assets/a2ab8538-b636-4554-8a1d-a4c7e551caa4" />


https://github.com/user-attachments/assets/18a0610f-4d7d-4487-bbad-29c8a21c746b


https://github.com/user-attachments/assets/e2f84ab2-993c-4ebc-9dbd-8d91b1e03604


[![Gemini API](https://img.shields.io/badge/Powered%20by-Gemini%20API-blue)](https://ai.google.dev/)
[![LangChain](https://img.shields.io/badge/Framework-LangChain-green)](https://www.langchain.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**OneProduct-Agent-OS**, karmaşık e-ticaret süreçlerini, ürün yönetimini ve pazar analizi operasyonlarını tek bir otonom yapay zeka işletim sistemi (Agentic OS) altında birleştiren yeni nesil bir ajan platformudur. 

---

## 📌 Problem Tanımı ve Çözüm

### **Problem:**
Günümüz e-ticaret ve ürün yönetimi ekosistemlerinde veriler; pazar analizi, rakip takibi, stok yönetimi, müşteri geri bildirimleri ve pazarlama stratejileri gibi farklı kanallara dağılmış durumdadır. İnsan yönetimi gerektiren bu süreçler, veri aktarımında gecikmelere, yanlış fiyatlandırma stratejilerine ve trendlerin kaçırılmasına yol açarak operasyonel verimliliği düşürür.

### **Çözüm:**
**OneProduct-Agent-OS**, tüm bu dağıtık süreçleri otonom iş akışlarına dönüştürür. Gelişmiş dil modelleri ve ajan mimarisi sayesinde pazar trendlerini analiz eder, dinamik kararlar alır, ürün yaşam döngüsünü uçtan uca yönetir ve işletmelerin insan gücüne bağımlı kalmadan 7/24 optimize bir şekilde çalışmasını sağlar.

---

## 🏗️ Sistem Mimarisi

Aşağıdaki diyagram, sistemin çoklu-ajan (Multi-Agent) mimarisini, veri akışını ve Gemini API ile olan entegrasyonunu göstermektedir:

 
    User([Kullanıcı / API Tetikleyici]) --> Orchestrator[Ajan Orkestratörü / LangChain]
    
    subgraph Ajan Katmanı (Agent OS)
        Orchestrator --> AgentA[Pazar & Trend Analiz Ajanı]
        Orchestrator --> AgentB[Fiyatlandırma & Stok Ajanı]
        Orchestrator --> AgentC[Pazarlama & İçerik Üretim Ajanı]
    end
    
    subgraph Akıllı Karar Mekanizması
        AgentA --> Gemini[Google Gemini API]
        AgentB --> Gemini
        AgentC --> Gemini
    end
    
    subgraph Veri & Araç Katmanı
        Gemini --> VectorDB[(Vektör Veritabanı / RAG)]
        Gemini --> WebSearch[Web Arama / Scraping Tool]
    end
    
    Gemini -->|Otonom Çıktı / Aksiyon| Output[E-Ticaret Platformu / Dashboard]
🛠️ Teknoloji Yığını
LLM Çekirdeği: Google Gemini API (gemini-1.5-pro & gemini-1.5-flash)

Ajan Çerçevesi (Framework): LangChain / LangGraph (Otonom planlama ve state yönetimi için)

Veritabanı / RAG: ChromaDB / Pinecone (Ürün bilgileri ve anlamsal hafıza için)

Backend: Python 3.10+, FastAPI

Bağımlılık Yönetimi: Poetry / Pip

⚡ Gemini ile "Fark Yaratan" Teknik Özellikler
OneProduct-Agent-OS, standart LLM çağrılarının ötesine geçerek Gemini'ın benzersiz yeteneklerini mimarisinin merkezine konumlandırır:

Gelişmiş "Function Calling" (Araç Kullanımı): Gemini’ın native fonksiyon çağırma yeteneği sayesinde ajanlarımız; canlı pazar verilerini çekmek, stok durumunu sorgulamak ve veritabanı güncellemelerini sıfır hata ile yapılandırılmış veri (JSON) formatında gerçekleştirmek için API'leri doğrudan yönetir.

Geniş Bağlam Penceresi (Context Window): Gemini 1.5 Pro'nun sunduğu devasa bağlam penceresi, aylık satış raporlarının, binlerce satırlık müşteri yorumlarının ve rakip analiz dokümanlarının aynı anda RAG (Retrieval-Augmented Generation) kaybı yaşanmadan tek bir bağlamda işlenmesine olanak tanır.

Çoklu Modallık (Multimodality): Sistem sadece metin tabanlı verileri değil; ürün görsellerini, infografikleri ve rakip reklam tasarımlarını da Gemini üzerinden analiz ederek görsel trend takibi gerçekleştirebilir.

## ⚙️ Kurulum ve Çalıştırma

Proje iki bölümden oluşur: **backend** (FastAPI, port 8000) ve **frontend** (Vite + React, port 5173). Aşağıda her işletim sistemi için kurulum adımları bulunmaktadır.

### Ön Koşullar (Tüm Platformlar)

- **Python** 3.11 veya üzeri
- **Node.js** 18 veya üzeri (LTS önerilir)
- **Git**
- Bir **Gemini API Key** ([aistudio.google.com/apikey](https://aistudio.google.com/apikey))

### 1. Depoyu Klonla (Ortak)

```bash
git clone https://github.com/NeoMagic-coder/OneProduct-Agent-OS.git
cd OneProduct-Agent-OS
```

### 2. Ortam Değişkenleri (Ortak)

`backend/.env.local` dosyasını oluştur:

```env
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash
VITE_GEMINI_API_KEY=AIza...
VITE_GEMINI_MODEL=gemini-2.5-flash
LLM_PROVIDER=gemini
```

---

### 🍎 macOS

```bash
# Python ve Node yoksa Homebrew ile kur
brew install python@3.12 node git

# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r apps/api/requirements.txt
uvicorn apps.api.main:app --reload --port 8000
```

Yeni bir terminal sekmesinde:

```bash
cd frontend
npm install
npm run dev
```

Veya repo kökünden her ikisini birden başlatmak için:

```bash
scripts/dev.sh
```

---

### 🐧 Linux (Ubuntu / Debian)

```bash
# Gerekli paketler
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nodejs npm git

# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r apps/api/requirements.txt
uvicorn apps.api.main:app --reload --port 8000
```

Yeni bir terminalde:

```bash
cd frontend
npm install
npm run dev
```

> **Not:** Eski dağıtımlarda Node sürümü düşükse [NodeSource](https://github.com/nodesource/distributions) veya `nvm` ile güncel sürümü kur.

---

### 🪟 Windows (PowerShell)

```powershell
# Python ve Node yoksa winget ile kur
winget install Python.Python.3.12
winget install OpenJS.NodeJS.LTS
winget install Git.Git

# Backend
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r apps\api\requirements.txt
uvicorn apps.api.main:app --reload --port 8000
```

> Eğer `Activate.ps1` engellenirse PowerShell'i **Yönetici** olarak açıp şunu çalıştır:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

Yeni bir PowerShell penceresinde:

```powershell
cd frontend
npm install
npm run dev
```

> **Stale env değişkeni uyarısı:** Backend "API key not valid" diye şikayet ederse sistemde eski bir `GEMINI_API_KEY` ortam değişkeni gölgeliyor olabilir. Temizle:
> ```powershell
> Remove-Item Env:GEMINI_API_KEY
> ```

---

### Erişim

Servisler ayağa kalktıktan sonra:

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **Swagger Docs:** http://localhost:8000/docs

### Testler

```bash
# Backend testleri (backend/ dizininden)
pytest apps/api/tests -q

# Frontend E2E testleri (frontend/ dizininden)
npx playwright install chromium  # ilk seferde
npm run test:e2e

# Tam doğrulama (tsc + vite build + pytest)
scripts/check.sh
```

🤝 Katkıda Bulunma (Contributing)
Bu depoyu çatallayın (Fork).

Özellik dalınızı oluşturun (git checkout -b feature/AmazingFeature).

Değişikliklerinizi kaydedin (git commit -m 'Add some AmazingFeature').

Dalınıza gönderin (git push origin feature/AmazingFeature).

Bir Çekme İsteği (Pull Request) açın.

📄 Lisans
Bu proje MIT Lisansı altında lisanslanmıştır. Detaylar için LICENSE dosyasına göz atabilirsiniz.
