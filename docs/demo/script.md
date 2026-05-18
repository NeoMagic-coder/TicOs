# OneProduct Agent OS — 5 Dakikalık Demo Senaryosu

**Hedef:** Jüriye 22 ajan + 89 araç + Gemini'nin 5 yeteneği tek hikâyede gösterilsin. Türkçe anlatım. Sonunda jüri "ROI ne?" sorusunu hazır cevapla karşılasın.

**Önkoşullar (pitch sabahı 1 saat önce çalıştır):**
- `scripts/dev.sh` — backend (8000) + frontend (5173) ayakta
- `GEMINI_API_KEY` `.env.local`'de set
- Trendyol Partner creds set (yoksa breaker mock'a düşer, demo devam eder)
- Tarayıcı: `http://localhost:5173/dashboard` açık, ROI banner reset durumunda
- Mikrofon test: VoiceDock → "test" → toast görünmeli

---

## Sahne 1 — Açılış (0:00–0:30)

**Sayfa:** `/onboarding`

**Anlatım:**
> "OneProduct Agent OS — tek bir ürün etrafında çalışan 22 uzman ajan ve 89 araçlı bir e-ticaret işletim sistemi. Bir KOBİ için marka kimliği, fiyatlandırma, listeleme, müzakere — hepsini otonom yürütüyor. Bugün size 3 saatlik bir otonom yarışı 3 dakikaya sıkıştırarak göstereceğim."

**Aksiyon:** Onboarding'de bir rakip ürün URL'si yapıştır. `image_analysis` (Gemini Vision) ürün görselini parse eder.

**Gemini özelliği vurgusu:** Vision API.

---

## Sahne 2 — Voice Supervisor (0:30–1:15)

**Sayfa:** Sağ üst köşedeki **VoiceDock** ikonuna bas (`/components/VoiceDock.tsx`).

**Anlatım:**
> "Komutu sesli vereceğim. Backend, Gemini Live API üzerinden ses akışını alır, Türkçe transcribe eder, intent'i Hermes orkestratörüne yönlendirir."

**Söylenen komut:**
> "Bu üründe marka kimliği oluştur, fiyatla ve Trendyol'a listele."

**Beklenen:**
- VoiceDock toast: transcript görünür
- 4–5 ajan paralel başlar (chat akışı görünür)

**Gemini özelliği vurgusu:** Live API (bidirectional audio).

---

## Sahne 3 — Autonomy Console (1:15–2:30)

**Sayfa:** `/autonomy` aç. (Daha önce yoksa, sol sidebar'dan.)

**Anlatım:**
> "Şu an gördüğünüz sol panel 22 ajanın canlı nabzı. Orta panelde Hermes'in çizdiği görev DAG'ı. Sağda her OpenClaw tool çağrısının cost ve latency'si akıyor. Üstte AutonomyPolicy slider'ları."

**Aksiyon — DEMO OYNAT:**
1. Sağ üstteki **▶ Demo Oynat** butonuna bas
2. `/api/v1/demo/play` SSE 6 sahneyi ~2 dakikada akıtır
3. DAG yeşile dönmeye başlar, audit log dolar
4. **Slider deneyi:** `max_price_change_pct` slider'ını 5 → 3'e çek
5. Pricing Agent'ın aynı önerisi `auto_approved` → `needs_approval` durumuna düşer

**Anlatım:**
> "Politikayı sıkıştırdığım anda DecisionEngine — deterministik, LLM'siz — aynı kararı onaya yükseltti. Yani jürinin gözü önünde bir Gemini wrapper'ı değil; gerçek bir karar motoru çalışıyor."

**Gemini özelliği vurgusu:** Text generation + Embedding (her ajan Gemini Flash Lite + pgvector memory).

---

## Sahne 4 — Trendyol Live Adapter (2:30–3:15)

**Sayfa:** `/audit` veya AutonomyConsole sağ panel.

**Anlatım:**
> "Pricing kararı `auto_approved` olduğunda `trendyol_update_price` live adapter gerçek Partner API'ye gidiyor. pybreaker circuit yeşilse istek yapıyor, kapalıysa graceful degradation ile mock'a düşüyor — demoyu kırmıyor."

**Aksiyon:** Audit log'da `trendyol_update_price` satırına tıkla, response payload + KVKK denetim satırı görün.

**Gemini özelliği vurgusu:** (yok — burada production engineering vurgusu)

---

## Sahne 5 — Müzakere (3:15–4:00)

**Sayfa:** AutonomyConsole demo'sunda 5. sahne otomatik geliyor.

**Anlatım:**
> "NegotiationAgent, sahte bir tedarikçi ile 3 turlu fiyat müzakeresi yürüttü. Counter-offer'lar Gemini'den geldi; final anlaşma DecisionEngine onaylı — `final_cogs` 65 TL'den 48 TL'ye düştü."

**Aksiyon:** Demo player summary'sinde negotiation outcome görünür.

**Gemini özelliği vurgusu:** Text generation (üretici yapay zekâ negosyasyon stratejisi).

---

## Sahne 6 — ROI Kapanış (4:00–5:00)

**Sayfa:** `/dashboard`

**Aksiyon:** ROI Story banner'da "▶ Oynat" → mode 2 (Sonuç).

**Beklenen:** Animasyonlu sayaç 0 → **+%18.4** brüt kâr marjı.

**Anlatım (kapanış):**
> "3 sanal saat sonra: 47 otonom karar, 3 insana yükseltilen, brüt kâr marjı +%18.4. Toplam Gemini maliyeti $0.41. İnsan eşdeğeri: 5 kişi × 1 hafta. Bu sistem, BTK Akademi Gemini API'nin 5 ayrı endpoint'ini — Text, Vision, Image, Live, Embedding — tek bir ürün hikâyesinde birleştiriyor. GitHub: github.com/.../oneproduct-agent-os. Teşekkürler."

---

## Yedek Plan

| Sorun | Aksiyon |
|-------|---------|
| Backend düşerse | Demo video YouTube unlisted oynat |
| Gemini 429 | MockProvider fallback otomatik; demo player deterministik |
| Mikrofon çalışmıyor | VoiceDock yerine `/chat` üzerinden metin komut |
| Trendyol creds geçersiz | Circuit breaker mock'a düşer, "degraded=true" rozeti gösterilir |
| WiFi yok | Yerel SQLite + MockProvider — tüm demo çevrimdışı çalışır |

## Sahne Sonrası Soru-Cevap Hazırlık

**S:** Bu sadece Gemini'nin etrafında bir wrapper değil mi?
**C:** Hayır — DecisionEngine ve HybridPricingPolicy LLM çağırmıyor, deterministik karar motorları. AutonomyPolicy'yi slider'la kıstığımda Gemini'nin aynı yanıtının onay durumu değişti. (Slayt 6'da göster.)

**S:** 89 araç çok abartılı değil mi?
**C:** Manifest sayısı 89, ama 44'ü `live` (gerçek HTTP), 45'i `mock` (geliştirme için stub). Yeni adapter eklemek 1 JSON manifest + 1 Python fonksiyon — `apps/api/tools/live/`.

**S:** Multi-tenant?
**C:** Şu an tek tenant; Postgres + pgvector mimarisi multi-tenant'a hazır, sadece middleware eklenmedi (Roadmap).

**S:** Türk pazarına özel ne var?
**C:** Türkçe sistem promptları + Türkçe executive summary + Trendyol/Hepsiburada/n11 adapter'ları + CollectAPI 6 tool + KVKK compliance checker.
