# OneProduct Agent OS - 90 Saniyelik Demo Videosu

## 📹 Demo Video Senaryosu (Adım Adım)

### Sahne 1: Onboarding (0-15s) — Gemini Vision
**Aksiyon:** Kullanıcı telefon kamerasını açıp bir ürün fotoğrafı çekiyor (örneğin, bir çanta).

**Ekran Görüntüsü:**
- Frontend'de "Ürün Fotoğrafı Yükle" butonu
- Kullanıcı fotoğraf yüklüyor
- Backend'de Gemini Vision analiz ediyor
- Otomatik kategori, renk, materyal algılama

**Görsel Metin:** "Gemini Vision: Ürün algılandı → Çanta, deri, siyah, orak boyut"

**Ses (Türkçe):**
> "Ürünü sisteme eklemek için sadece fotoğrafını çekiyorum. Gemini görseli analiz edip ürün özelliklerini otomatik çıkarıyor."

---

### Sahne 2: Voice Command (15-30s) — Gemini Live
**Aksiyon:** Kullanıcı mikrofona tıklayıp Türkçe komut veriyor.

**Komut:** "Fiyatı 500 TL yap, Trendyol'da yayınla"

**Ekran Görüntüsü:**
- Voice input modal açılıyor
- Waveform animasyonu (ses algılanıyor)
- Gemini Live API real-time transcription
- Komut parse ediliyor → Intent: price_change + listing_publish

**Görsel Metin:**
> "Intent: price_change (500TL) + publish (Trendyol)"

**Ses (Türkçe):**
> "Trendyol'da satış fiyatını 500 lira olarak belirle ve yayınla diyorum. Sistem sesli komutu anlayıp gerekli işlemleri başlatıyor."

---

### Sahne 3: Autonomy Console - DAG Görselleştirme (30-50s)
**Aksiyon:** Frontend'de DAG (Directed Acyclic Graph) canlı olarak akıyor.

**Ekran Görüntüsü:**
- Node'lar sırayla yanıyor (yeşil = running, mavi = completed)
- CEO Agent → Pricing Agent → Trendyol Adapter
- Her node'dan tooltip: "confidence: 0.87", "cost: $0.02"
- Edge'lerde oklar akıyor

**DAG Akışı:**
```
[CEO Agent] ──► [Pricing Agent] ──► [Trendyol API]
      │              │
      ▼              ▼
 [Research]    [Margin Calc]
```

**Görsel Metin:** "47 otomatik karar / gün | Confidence: 0.87"

**Ses (Türkçe):**
> "Otonomi katmanı devreye giriyor. Decision Engine her kararı değerlendiriyor. Güvenlik eşiği altındaki işlemler otomatik onaylanıyor, üstündeki işlemler bana yönlendiriliyor."

---

### Sahne 4: Trendyol Live Action (50-70s)
**Aksiyon:** Trendyol yönetim panelinde ürün yayınlanıyor.

**Ekran Görüntüsü:**
- Trendyol Seller Center screenshot (simüle edilmiş)
- Ürün listing'i: başlık, fiyat, görsel, stok
- Backend log'ları: "API call: POST /products", "200 OK"
- Canlı sipariş bildirimi: "Sipariş alındı: #TR-12345"

**Görsel Metin:**
> "Listing oluşturuldu ✓ | Stok: 100 | Fiyat: 500 TL | Status: Aktif"

**Ses (Türkçe):**
> "Trendyol API'si ile entegre çalışıyor. Ürünüm sisteme eklendi, fiyat ve stok yönetimi otomatik yapılıyor. Siparişler anlık takip ediliyor."

---

### Sahne 5: ROI Kapanış (70-90s)
**Aksiyon:** Dashboard'da performans metrikleri.

**Ekran Görüntüsü:**
- Grafik: +%18.4 kar artışı (yeşil ok yukarı)
- Maliyet: $0.41 / işlem
- Zaman tasarrufu: %80
- Otonom kararlar: 47 / gün

**Görsel Metin:**
> "+%18.4 Kar | $0.41 Maliyet | %80 Tasarruf | 47 Karar/Gün"

**Ses (Türkçe):**
> "Sonuç: Yüzde 18.4 kar artışı, işlem başına 41 sent maliyet ve yüzde 80 zaman tasarrufu. Bir kişi, tüm e-ticaret operasyonlarını otonom olarak yönetebiliyor."

---

## 🎬 OBS Ayarları

### Video Ayarları
| Ayar | Değer |
|------|-------|
| Çözünürlük | 1920x1080 |
| FPS | 30 |
| Bitrate | 6000 kbps |
| Encoder | NVENC (NVIDIA) veya Hardware (macOS) |
| Format | MP4 (H.264) |

### Sahne Düzeni
```
┌──────────────────────────────────────────────────────┐
│                                                      │
│   [Sol Panel: Frontend UI]    [Sağ Panel: Terminal] │
│                                                      │
│   • Ürün ekleme              • Backend log'ları    │
│   • Voice input              • API çağrıları        │
│   • DAG visualization        • Hata / info mesajları│
│                                                      │
├──────────────────────────────────────────────────────┤
│   [Alt Panel: Chrome DevTools Console]               │
│   • Network istekleri • WebSocket messages          │
└──────────────────────────────────────────────────────┘
```

### Kayıt Kısayolları
- **Başlat/Durdur:** Ctrl+Shift+S (OBS)
- **Tam ekran screenshot:** Win+Shift+S (Windows) / Cmd+Shift+4 (macOS)
- **Pencere yakala:** Alt+Tab → OBS Scene切换

### Önerilen Overlay'ler
1. **Logo watermark:** Sağ alt köşe, %20 opaklık
2. **Süre sayacı:** Sol üst, "00:00 - 01:30"
3. **Fare vurgusu:** Capture cursor enabled

---

## 📝 Türkçe Altyazı Metni (VTT Formatı)

```vtt
WEBVTT

00:00:00.000 --> 00:00:05.000
[Intro müziği]

00:00:05.000 --> 00:00:10.000
OneProduct Agent OS - Tam Otonom E-ticaret

00:00:10.000 --> 00:00:15.000
Ürünü sisteme eklemek için sadece fotoğrafını çekiyorum.

00:00:15.000 --> 00:00:20.000
Gemini görseli analiz edip ürün özelliklerini otomatik çıkarıyor.

00:00:20.000 --> 00:00:25.000
Trendyol'da satış fiyatını 500 lira olarak belirle ve yayınla diyorum.

00:00:25.000 --> 00:00:30.000
Sistem sesli komutu anlayıp gerekli işlemleri başlatıyor.

00:00:30.000 --> 00:00:35.000
Otonomi katmanı devreye giriyor.

00:00:35.000 --> 00:00:40.000
Decision Engine her kararı değerlendiriyor.

00:00:40.000 --> 00:00:45.000
Güvenlik eşiği altındaki işlemler otomatik onaylanıyor.

00:00:45.000 --> 00:00:50.000
Üstündeki işlemler bana yönlendiriliyor.

00:00:50.000 --> 00:00:55.000
Trendyol API'si ile entegre çalışıyor.

00:00:55.000 --> 01:00:00.000
Ürünüm sisteme eklendi, fiyat ve stok yönetimi otomatik yapılıyor.

01:00:00.000 --> 01:00:05.000
Siparişler anlık takip ediliyor.

01:00:05.000 --> 01:00:10.000
Sonuç: Yüzde 18.4 kar artışı.

01:00:10.000 --> 01:00:15.000
İşlem başına 41 sent maliyet.

01:00:15.000 --> 01:00:20.000
Yüzde 80 zaman tasarrufu.

01:00:20.000 --> 01:00:25.000
Bir kişi, tüm e-ticaret operasyonlarını otonom olarak yönetebiliyor.

01:00:25.000 --> 01:00:30.000
[Outro müziği - Teşekkürler]
```

---

## 🎥 Video Çekim Checklist

### Ön Çekim
- [ ] Backend çalışıyor (uvicorn port 8000)
- [ ] Frontend çalışıyor (vite port 5173)
- [ ] Trendyol API mock hazır
- [ ] Mikrofon test edildi
- [ ] OBS kayıt ayarları doğru

### Çekim Sırası
1. Kamerayı aç, ürün fotoğrafı çek
2. Voice input'a tıkla, komut ver
3. DAG'ı canlı göster
4. Trendyol panelini göster
5. Dashboard metriklerini göster

### Post-Prod
- [ ] Altyazı ekle (VTT)
- [ ] Intro/outro müzik
- [ ] Geçiş efektleri (fade)
- [ ] Ses seviyesi normalize
- [ ] Export: MP4, 1080p

---

## 📦 Bundle Komutu (macOS)

```bash
# OBS kaydından sonra video birleştirme
ffmpeg -i "video.mp4" -i "demo_audio.m4a" \
  -c:v copy -c:a aac -map 0:v:0 -map 1:a:0 \
  final_demo.mp4

# Altyazı embed
ffmpeg -i final_demo.mp4 -vf "subtitles=demo_subs.vtt" \
  final_with_subs.mp4
```

---

## 🔗 Bağlantılar

- **Demo:** https://demo.oneproduct.ai
- **GitHub:** https://github.com/NeoMagic-coder/oneproduct-agent-os
- **Doküman:** `/docs/whitepaper/`