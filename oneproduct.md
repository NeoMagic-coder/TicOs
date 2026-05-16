OneProduct Agent OS
Proje Analizi ve Geliştirme Yol Haritası
Hermes orkestrasyonu + OpenClaw tool-use mimarisi üzerine teknik değerlendirme
Hazırlayan: Claude (Cowork)  ·  Tarih: 14 Mayıs 2026
 
1. Yönetici Özeti
OneProduct Agent OS, tek bir ürün etrafında uçtan uca e-ticaret operasyonunu yönetmek için tasarlanmış, çok ajanlı (multi-agent) bir platformdur. Sistem iki ana katmandan oluşur: Hermes adı verilen orkestratör (görev grafı / DAG kurar, ajanları paralel koşturur, sonuçları birleştirir) ve OpenClaw adı verilen tool-use motoru (self-describing JSON manifest registry, permission scope, JSON-schema doğrulama, retry, fallback ve maliyet/audit kaydı).
Frontend Vite + React 19 + Tailwind v4 ile yazılmış tıklanabilir bir SPA; backend ise FastAPI + Pydantic + SQLAlchemy üzerine kurulu, Gemini API üzerinden Türkçe yanıtlar üreten asenkron bir servistir. Toplamda 18 uzman ajan + 70+ tool manifestinden bahseden mimari söylem ile gerçek kod tabanı arasında önemli mesafeler bulunuyor; ana iskelet sağlam ama "production-ready" bir SaaS olabilmesi için bilinçli ve etaplı bir geliştirme planına ihtiyaç var.
Bu doküman; projenin ne olduğunu, mimari güçlü/zayıf yönlerini, kritik eksikleri ve 6 aylık fazlara bölünmüş somut bir geliştirme yol haritasını sunar.
2. Proje Profili
Boyut	Değer
Proje adı	OneProduct Agent OS
Tip	Multi-agent SaaS prototipi / e-ticaret orkestrasyon platformu
Dil/UX dili	Türkçe (sistem promptları, UI metinleri, executive summary)
Backend	Python 3.13, FastAPI 0.115, Pydantic 2, SQLAlchemy 2, structlog, google-genai SDK 1.0
Frontend	React 19, TypeScript 5.9, Vite 7, Tailwind v4, Zustand 5, recharts, lucide-react
LLM	Gemini (2.5-flash → 2.0-flash → lite fallback zinciri); anahtar yoksa MockProvider
Veritabanı	SQLite (varsayılan), PostgreSQL string ile değiştirilebilir
Paketleme	vite-plugin-singlefile (frontend single-HTML), iki ayrı Dockerfile (api & web)
Dağıtım	docker-compose, Kubernetes (k8s/) manifestleri, GitHub Actions CI/CD
Test	pytest + pytest-asyncio; backend için 4 dosyalık test seti, frontend testi yok
Dokümantasyon	README, CLAUDE.md, PRODUCTION_DEPLOYMENT.md, LaTeX whitepaper (docs/whitepaper)
2.1 Bu proje aslında ne yapıyor?
Sistem, bir kullanıcının onboarding ile bir ürün (örn. "yanmaz tencere") tanımladığı, ardından chat veya sayfa içi butonlardan komut verdiği bir "tek ürün şirketi işletim sistemi" olarak konumlanıyor. Bir mesaj geldiğinde:
1.	POST /api/v1/chat → HermesOrchestrator.handle() çağrılır.
2.	router.route() anahtar-kelime tabanlı sezgisel ile primary + supporting ajanları seçer.
3.	TaskGraph kurulur; primary ilk dalga, supporting ikinci dalgada paralel çalışır (asyncio.gather).
4.	Her ajan kendi system_prompt + primary_tools listesiyle çalışır; her tool çağrısı OpenClaw üzerinden permission + JSON-schema + retry + fallback + cost ile çalıştırılır ve ExecutionContext.audit'e yazılır.
5.	_merge() ajan çıktılarını LLM ile tek bir Türkçe yönetici özetine harmanlar; LLM hata verirse bulleted digest fallback üretir.
6.	Confidence < 0.6 ise "escalated", ⚠️ ile başlayan satırlar onay kuyruğuna çevrilir.
3. Mimari Değerlendirme
3.1 Güçlü yönler
•	Net katman ayrımı: Orchestration (Hermes) ile tool-use (OpenClaw) birbirinden temiz ayrılmış; agents/, core/hermes/, core/openclaw/ klasörleri tek sorumluluk taşıyor.
•	Self-describing tool registry: Tool'lar JSON manifest ile besleniyor (apps/api/tools/manifests/), runtime'da rglob ile yükleniyor, allowed_agents alanı izin kapısı olarak çalışıyor — yeni tool eklemek kod değişikliği gerektirmiyor.
•	LLM abstraction: core/llm/provider.py içindeki LLMProvider + GeminiProvider + MockProvider yapısı testleri ağdan bağımsız tutuyor; fallback model zinciri ve semafor ile RPM koruması düşünülmüş.
•	Audit & cost tracking: Her tool çağrısı ToolCallLog olarak biriktiriliyor, ExecutionContext.cost_so_far_usd ve budget_usd ile bütçe kontrolü mevcut.
•	Türkçe-first ürün dili: Tüm system promptları, UI ve özet metinleri tutarlı şekilde Türkçe — hedef pazara uygun bir konumlandırma.
•	Reproducible dev: flake.nix, scripts/dev.sh, scripts/check.sh ve env.example dosyaları geliştirici onboard'ını kolaylaştırıyor.
•	CI/CD ve container hazırlığı: Dockerfile.api, Dockerfile.web, docker-compose.prod.yml, k8s/ manifestleri, GitHub Actions pipeline'ı (test → build → security scan → staging/prod) hazır.
•	Konsept netliği: "Tek ürün etrafında ajan ekosistemi" konumlandırması, klasik Shopify-app çorbasına göre ayırt edici bir hikaye sunuyor; whitepaper bunu akademik dille destekliyor.
3.2 Zayıf / Eksik yönler
Alan	Tespit	Risk
Routing	router.py saf anahtar-kelime tabanlı, "yorum" gibi tek kelimeler yanlış ajana yönlendirebilir; embedding/LLM sınıflandırıcı yok.	Orta
Tool envanteri	Manifests klasöründe sadece 4 JSON dosyası var; README'deki "70+ tool" söylemi gerçekleşmemiş.	Yüksek (söylem-gerçek farkı)
Live adapter	Yalnızca brand_visual_generator için canlı adapter kayıtlı; geri kalan her şey mock_response'dan deterministik fake değer üretiyor.	Yüksek
Agent çeşitliliği	SEED'de 18 spec olmasına rağmen AGENT_CLASSES'ta sadece 6 sınıf var; diğerleri GenericAgent fallback'ine düşüyor.	Orta
Kalıcılık	TaskRow / ApprovalRow tabloları mevcut ama orchestrator.handle() çıktısı DB'ye persist edilmiyor; tasks/approvals route'ları boş veriyle çalışır halde.	Yüksek
Kimlik & yetki	Auth yok; CORS'tan herkes /chat endpoint'ini çağırabilir, API key/JWT/RBAC katmanı tanımsız.	Kritik (prod blok)
Frontend güvenliği	src/lib/gemini.ts API anahtarını tarayıcıda paketliyor — README de bunu kabul ediyor; production'da frontend yalnızca backend'e konuşmalı.	Kritik
Frontend store	useStore.ts 1154 satır, tek monolit dosya; sayfa-özel iş mantığı, intent matcher, LLM çağrıları aynı yerde — bakım maliyeti yüksek.	Orta
Test kapsamı	Backend: 4 dosya, sadece OpenClaw + TaskGraph + Router primitivleri test ediliyor; orchestrator end-to-end yok. Frontend: 0 test.	Yüksek
Gözlemlenebilirlik	structlog event isimleri var ama metric/trace yok; OpenTelemetry, Prometheus exporter, request_id propagation eksik.	Orta
Maliyet kontrolü	budget_usd alanı var ama nereden set edilecek belirsiz; per-tenant/per-task quota & alarm yok.	Orta
DB & migration	SQLite + init_db() create_all; Alembic migration scheme yok, prod'da PostgreSQL'e geçiş riskli.	Yüksek
Insan-onay döngüsü	Kod ⚠️ ile başlayan satırları RecommendedAction'a çeviriyor; onay UI'ı sayfada var ama orchestrator işleyişine bağlı bir "waiting_human_approval" durumu yok — confirm/deny sonrası ajan akışı devam etmiyor.	Yüksek
Memory / vektör arama	core/memory boş; ürün geçmişi, önceki ajan çıktıları, knowledge base araması yok.	Yüksek (uzun vadeli)
Streaming	Chat endpoint REST tek-atış; SSE/WS streaming yok, kullanıcı uzun ajan akışında bekliyor.	Orta
3.3 Söylem-gerçek farkı
README'de geçen "18 ajan + 70+ tool" ifadesi prototip için bir vaat; mevcut kodda 18 AgentSpec (6'sı uzmanlaşmış sınıf, kalanı generic) ve 4 manifest dosyası (toplam tool sayısı manifestlerdeki kayıt sayısı kadar) bulunuyor. Bunu açıkça PRD'de "iddia edilen vs. teslim edilen" matrisine çevirmek, gelecekteki kullanıcı/iş ortağı sunumlarında sürprizleri önler.
4. Performans, Güvenlik ve Operasyon Notları
4.1 Performans
•	asyncio.gather ile ajan paralelliği iyi; ancak Gemini semaforu (llm_max_concurrency=2) ile darboğaz oluşuyor — production'da paid tier RPM ile bu sınırı ayarlanabilir hale getirmek gerek.
•	Tool retry sabit (max_attempts=2) ve linear; exponential backoff + jitter yok. _extract_retry_delay sadece Gemini içindir, OpenClaw retry'larında değil.
•	TaskGraph.ready() her döngüde tüm nodeları tarar; küçük graflar için sorun değil ama 100+ node'lu senaryolarda O(N²) potansiyeli var.
4.2 Güvenlik
•	CORS allow_origins = localhost listesi sabit — prod için env-driven hale gelmeli; allow_methods="*" ve allow_credentials=True kombinasyonu CSRF açısından dikkatli kullanılmalı.
•	Tool input_schema jsonschema ile valide ediliyor; ama output_schema çalıştırma sırasında zorunlu tutulmuyor — LLM'in yanlış formatlı tool çıktısı sessizce geçebilir.
•	Live adapter sözleşmesi imza/secret içermiyor; canlı entegrasyonlar (Shopify, Klaviyo, Meta Ads) eklendiğinde her birine ayrı vault/secret-store entegrasyonu lazım.
•	Frontend'in tarayıcıda API key tutması (gemini.ts) kabul edilmiş bir prototip sınırlaması; production öncesi mutlaka backend proxy kullanılmalı.
4.3 Operasyon
•	docker-compose.prod.yml + k8s/ manifestleri hazır ama Helm chart / Kustomize overlay yok; multi-env (dev/stg/prod) için template parametrizasyonu eksik.
•	GitHub Actions workflow'u staging+prod'a deploy ediyor; ancak rollback adımı, smoke test ve veritabanı migration adımı tanımsız.
•	Loglar structlog ile JSON üretiyor ama log shipping (Loki, ELK, Datadog) entegrasyonu yok; uzun süreli audit log'lar SQLite'ta kalırsa scale etmez.
5. Geliştirme Planı
Aşağıdaki yol haritası ürünü "tıklanabilir prototip"ten "küçük ölçekli production SaaS"a taşımak için 4 fazda planlandı. Her faz 4–6 hafta arası, kabaca 1 backend + 1 frontend + 0.5 DevOps efor varsayımıyla. Fazlar bağımsız değer üretecek şekilde sıralandı; her birinin sonunda demo-edilebilir bir kilometre taşı var.
Faz 0 — Temizlik ve Stabilizasyon (1–2 hafta)
Amaç: Mevcut kod tabanını "vaat = teslim" çizgisine çekmek, riskli teknik borçları görünür kılmak.
7.	AGENT_CLASSES eksik kayıtlarını tamamla (18 ajanın hepsine, generic fallback yerine en azından spesifik system_prompt + primary_tools).
8.	Tool manifestlerini en az 20 gerçekçi tool'a çıkar (research, brand, pricing, growth, email, review, ops, legal, marketing, content_seo kategorilerinin her birinde 2+).
9.	README'deki sayısal vaatleri (18 ajan / 70+ tool) gerçek kod sayımı ile eşle ya da yazıyı güncelle.
10.	Orchestrator end-to-end test ekle (apps/api/tests/test_orchestrator.py) — MockProvider ile en az 3 farklı routing senaryosu.
11.	Frontend'e basit smoke test (Playwright veya Vitest + Testing Library) — onboarding → chat → sonuç akışı.
12.	CLAUDE.md'yi güncel kalan API'larla sync et; "Adding an agent" / "Adding a tool" prosedürlerini örnekle.
Faz 1 — Kalıcılık, Auth, Güvenlik (4–6 hafta)
Amaç: Single-tenant lokal prototipten multi-tenant kullanıma açılabilir bir backend'e geçmek.
Konu	Yapılacak iş	Çıktı
Auth	FastAPI dependency olarak JWT (auth.users tablosu) veya Clerk/Supabase Auth proxy.	POST /chat sadece authenticated kullanıcılar.
Multi-tenant	Tüm tablolara tenant_id kolonu, row-level filter middleware'i, ürün/agent/tool isolation.	Tek deployment, çok müşteri.
Persist	Hermes sonucu TaskRow + AgentOutputRow olarak yazılsın; approvals route gerçek veriden okunsun.	/api/v1/tasks geçmişi gerçek döner.
Migration	Alembic kurulum, init_db() yerine alembic upgrade head; PostgreSQL'e geçişi belgele.	Versiyonlanmış schema.
Secrets	.env.local yerine 1Password / AWS SM / GCP Secret Manager bağlayıcısı (config.py içinde provider abstraction).	Anahtarlar repo dışı.
Frontend	src/lib/gemini.ts kaldırılıp her LLM çağrısı backend'e proxy edilsin; VITE_GEMINI_API_KEY kullanım dışı.	Browser'da anahtar yok.
Rate limit	slowapi veya fastapi-limiter ile per-tenant /chat quota; OpenClaw budget_usd otomatik tenant planından beslensin.	Kötüye-kullanım koruması.
Audit	ToolCallLog'lar audit_logs tablosuna yazılsın; admin UI'da filtreli görüntüleme.	Compliance hazırlığı.
Faz 2 — Akıllı Orkestrasyon ve Bellek (4–6 hafta)
Amaç: Sezgisel routing'i gerçek LLM/embedding tabanlı planlayıcıya çevirmek; ajanlara uzun-dönemli hafıza vermek.
•	LLM Planner: router.py yerine bir "planner_agent" — kullanıcı mesajını + ürün context'ini alır, hangi ajanları, hangi sırayla ve hangi bağımlılıklarla çalıştıracağını JSON DAG olarak üretir.
•	Vektör bellek: core/memory altında pgvector (veya Qdrant/Pinecone) tabanlı bir long-term store; her AgentOutput, KnowledgeDocument, review yorumu embedding'lensin. Tool olarak memory_search eklensin.
•	Onay akışı: TaskGraph "waiting_human_approval" durumu desteklesin; UI'dan approve/reject olduğunda task graph aynı yerden devam etsin (state restore).
•	Streaming: /chat endpoint'i için SSE; her ajan adımı, her tool çağrısı progress event'i göndersin. Frontend'de SupervisorChatDock canlı şekilde "Pricing Agent çalışıyor..." göstersin.
•	Cost & token telemetry: LLMResponse.tokens_used DB'ye yazılsın; tenant başına aylık token + tool maliyet özeti dashboard'a düşsün.
•	Self-evaluation: Critic-agent — bir ajan çıktısını "yeterince somut mu, sayı içeriyor mu, halüsinasyon riski var mı" diye 0–1 arası skorlasın; düşükse yeniden çalıştırma veya escalate.
Faz 3 — Gerçek Entegrasyonlar (6–8 hafta)
Amaç: "mock_response" yerine, ajanların gerçek dünya verisi okuyup yazabildiği en az 3 kanal.
13.	Shopify Admin API: store_setup, catalog, order, stock_levels tool'ları için live adapter; ngrok/Webhook tunnel ile webhook handler.
14.	Meta Ads + Google Ads: marketing_agent için get_campaigns, budget_update; OAuth flow + token refresh.
15.	Klaviyo / Mailchimp: email_crm_agent için flow_setup, segment_builder; rate-limit-aware retry.
16.	Review kaynakları: Trustpilot/Trendyol scraping yerine resmi feed/API; review_aggregator live mod.
17.	Image gen: brand_visual_generator zaten canlı; Gemini Image yerine fallback olarak Stable Diffusion / Imagen API.
18.	Tüm canlı tool'lar circuit breaker (pybreaker) ile sarılsın; provider down ise mock'a graceful degrade.
Faz 4 — Ölçek, Gözlem ve Pazara Hazırlık (4–6 hafta)
Alan	Aksiyon
Gözlem	OpenTelemetry SDK, OTLP exporter; Grafana Tempo / Honeycomb trace, Prometheus metrics, Sentry exception.
Async iş	Uzun ajan akışları için Celery / RQ / Arq worker; apps/api/workers/ klasörü dolsun, /chat sadece job_id dönsün, frontend SSE ile dinlesin.
DB ölçek	PostgreSQL + read replica; audit_logs partitioning (aylık), eski kayıtlar S3'e parquet olarak arşivlensin.
Cache	Redis: tool sonuçları (kategori bazında TTL), routing decision cache, rate limit counter.
Frontend	useStore.ts'i feature-based slice'lara böl (useChatStore, useAgentsStore, useBrandStore...). React-Router yerine pages' ı sade tutan zustand router gerek değil; route bazlı code-split.
UI/UX	Onboarding 4-5 adımdan tek scrollable wizard'a; chat'ten gelen "executeSupervisorAction" intent'leri global komut paleti haline getirilsin (cmd+k).
Lokalizasyon	Türkçe varsayılan kalsın; i18n key'lerle EN ekle. UI metinleri için bir useTranslation hook.
Pazarlama	Landing sitesi (oneproduct.ai), pricing katmanları (Free/Pro/Scale), trial flow, billing (Stripe).
SOC2-lite	Audit log retention politikası, access log, encryption at rest (PostgreSQL), backup runbook.
6. Önceliklendirilmiş Backlog (Top 20)
Aşağıdaki tablo "neyi yarın yapsam en çok değer üretir" sırasıyla 20 maddeyi listeler. Etki ve efor 1–5 arası; öncelik = etki × ((6 − efor) / 5).
#	Madde	Etki	Efor	Faz
1	Hermes sonucunu DB'ye persist et (tasks + audit)	5	2	F1
2	Auth + tenant_id + RLS middleware	5	3	F1
3	Frontend'i tamamen backend proxy üzerinden çalıştır (API key browser'dan çıksın)	5	2	F1
4	LLM-tabanlı planner_agent ile routing değişimi	5	3	F2
5	/chat için SSE streaming	4	3	F2
6	AGENT_CLASSES eksiklerini doldur (12 ajan)	4	2	F0
7	Manifest sayısını 20+ gerçekçi tool'a çıkar	4	3	F0
8	pgvector + memory_search tool	4	3	F2
9	Alembic migration kurulumu	4	2	F1
10	Orchestrator end-to-end pytest seti	4	2	F0
11	OpenTelemetry trace + Prometheus metrics	4	3	F4
12	Per-tenant rate limit + budget enforcement	4	2	F1
13	Shopify live adapter (en az 3 tool)	5	4	F3
14	Meta/Google Ads live adapter	5	4	F3
15	Onay döngüsünün gerçekten ajan akışını kesmesi	4	3	F2
16	useStore.ts'i slice'lara böl	3	3	F4
17	Frontend Playwright smoke testleri	3	2	F0
18	Helm chart + multi-env values	3	3	F4
19	Tool çıktısının output_schema ile validate edilmesi	3	2	F1
20	Stripe billing + plan tabanlı kota	4	4	F4
7. Riskler ve Hafifletme
Risk	Olasılık	Etki	Hafifletme
Gemini fiyat/kota değişimi tek vendor bağımlılığı yaratır	Yüksek	Yüksek	core/llm/provider.py zaten abstract; OpenAI / Anthropic / vLLM self-host provider'ı ekle, runtime'da seçilebilir yap.
Türkçe market'te paid tier benimsenmesi yavaş olabilir	Orta	Yüksek	Free tier + onboarding ile küçük kataloglarda gerçek değer kanıtla; vakaları case study'e çevir.
Mock'tan canlıya geçişte ajan halüsinasyonu pratik kararlara dönüşür	Yüksek	Yüksek	Faz 2'deki critic-agent + Faz 1'deki onay döngüsü; canlı yazma işlemlerinde "dry-run" varsayılan.
Tek dosya UI bundle (single-HTML) ölçekte yavaş	Orta	Orta	Faz 4'te route-bazlı code-split; admin paneli ayrı bundle.
SQLite prod'da kullanılır	Düşük	Yüksek	Alembic + PostgreSQL'i CI smoke test'inde zorunlu kıl; dev için bile SQLite'tan vazgeç.
18 ajan x 70 tool kombinasyon patlaması test edilemez hale gelir	Yüksek	Orta	Contract test framework: her tool için input_schema fuzz, her ajan için 3 golden response.
8. Önerilen 6 Aylık Takvim
Hafta bazında özet; gerçek planda Asana/Linear/Jira'da kırılır.
•	Hafta 1–2 (Faz 0): Temizlik, eksik ajanlar, tool manifest 20+, E2E test.
•	Hafta 3–8 (Faz 1): Auth, multi-tenant, persist, Alembic, frontend proxy, rate limit, audit.
•	Hafta 9–14 (Faz 2): LLM planner, pgvector bellek, streaming, kritik-onay döngüsü, critic-agent.
•	Hafta 15–22 (Faz 3): Shopify + Meta Ads + Klaviyo entegrasyonu, review feed, circuit breaker.
•	Hafta 23–26 (Faz 4): OpenTelemetry, Celery worker, Helm, landing + Stripe, ilk 5 pilot müşteri.
9. Sonuç
Mimari iskelet hem mühendislik hem ürün açısından yerinde: Hermes-OpenClaw ayrımı, JSON manifest registry, Pydantic schemas, Gemini fallback chain ve Türkçe-first konumlandırma sağlam temeller. Ana boşluk; orkestratörün gerçekten ürettiği işin kalıcılaştırılması, ajanların ve tool'ların mock'tan gerçeğe doğru kademeli geçişi, ve "production SaaS" için zorunlu olan auth/multi-tenant/observability katmanlarının kurulması.
Önerilen 4 faz, projeyi 6 ayda demo-edilebilir bir prototipten ilk müşteriyi taşıyabilir bir Türkiye-odaklı multi-agent e-ticaret platformuna taşır. Faz 0 + 1 (ilk 8 hafta) en yüksek getiri/risk oranını sunar; satış konuşmalarına başlanabilecek minimum bar buradadır.
