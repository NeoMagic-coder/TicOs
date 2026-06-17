# 🔬 AutoResearch Otonom Optimizasyon Tasarımı

Andrej Karpathy'nin bahsettiği "AutoResearch" (Otomatik Araştırma) otonom sistem tasarım prensipleri TicOsClaw'a entegre edilmiştir. Bu tasarımın merkezinde, insanın optimizasyon döngüsünde darboğaz olmasını engelleyerek sistemin kendi kendine en iyi parametreleri araması yer alır.

## 🏛️ Tasarım Bileşenleri

### 1. Metrik Odaklılık (Metric-Driven)
AutoResearch sistemi mutlaka net ve objektif olarak değerlendirilebilir bir başarı metriği ile çalışır.
- Varsayılan olarak fiyatlandırma optimizasyonu için tahmini ciro artış oranı (`expected_revenue_lift_pct`) metriği hedeflenir.
- Sistem bu değeri her iterasyonda ajan çıktılarından LLM yardımıyla otomatik olarak süzerek kaydeder.

### 2. program.md (Yönerge Dosyası)
Araştırma döngüsünün nasıl çalışacağını belirleyen rehber dosyadır.
- Dosya yolu: [[program]]
- Bu markdown belgesi optimizasyon hedeflerini, modunu (maximize/minimize), temel promptu ve iterasyon adımlarında ajanlara verilecek yönergeleri içerir.

### 3. Otonom Arama ve Hiperparametre Döngüsü (Autonomous Loop)
- [AutoResearchEngine](backend/apps/api/core/autoresearch/engine.py) sınıfı döngü yöneticisidir.
- Döngü adımlarında, önceki iterasyonların sonuçları (parametreler ve bunlardan elde edilen metrik değerleri) toplanarak LLM'e (Gemini) beslenir.
- LLM, tarifi ve geçmişi analiz ederek bir sonraki döngüde denenecek en optimum parametreleri (örn: `epsilon` keşif değeri veya `max_price_change_pct` limiti) tahmin eder.
- Parametreler `product_context` üzerinden ajanlara enjekte edilerek Hermes Orchestrator tetiklenir.

### 4. SQLite Kayıt ve Raporlama (Audit & Reporting)
- Her deneme adımı veritabanındaki `autoresearch_runs` tablosuna (`AutoResearchRunRow`) kaydedilir.
- Döngü bitiminde en yüksek başarı sağlayan parametreler seçilir ve tüm süreci detaylandıran markdown raporu oluşturulur: [[autoresearch_report]].

---

## 🌐 API Yüzeyi
- `POST /api/v1/autoresearch/run`: Arka planda döngüyü başlatır.
- `GET /api/v1/autoresearch/status/{goal_id}`: Hedefe ait iterasyon durumlarını ve en iyi parametre grubunu getirir.
- `GET /api/v1/autoresearch/runs`: Sistem genelindeki tüm optimizasyon geçmişini listeler.
