# OneProduct-Agent-OS 🚀

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

⚙️ Kurulum ve Çalıştırma
Projeyi yerel ortamınızda ayağa kaldırmak için aşağıdaki adımları takip edin:

1. Depoyu Klonlayın
Bash
git clone [https://github.com/NeoMagic-coder/OneProduct-Agent-OS.git](https://github.com/NeoMagic-coder/OneProduct-Agent-OS.git)
cd OneProduct-Agent-OS
2. Çevresel Değişkenleri Ayarlayın
Projenin ana dizininde bir .env dosyası oluşturun ve gerekli API anahtarlarınızı ekleyin:

Kod snippet'i
GEMINI_API_KEY=your_gemini_api_key_here
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_langchain_api_key_here
DATABASE_URL=your_database_url
3. Bağımlılıkları Yükleyin
Bash
# Pip ile kurulum için:
pip install -r requirements.txt

# veya Poetry kullanıyorsanız:
poetry install
4. Uygulamayı Başlatın
Bash
python main.py
(Eğer FastAPI interface kullanıyorsanız: uvicorn app.main:app --reload)

🤝 Katkıda Bulunma (Contributing)
Bu depoyu çatallayın (Fork).

Özellik dalınızı oluşturun (git checkout -b feature/AmazingFeature).

Değişikliklerinizi kaydedin (git commit -m 'Add some AmazingFeature').

Dalınıza gönderin (git push origin feature/AmazingFeature).

Bir Çekme İsteği (Pull Request) açın.

📄 Lisans
Bu proje MIT Lisansı altında lisanslanmıştır. Detaylar için LICENSE dosyasına göz atabilirsiniz.
