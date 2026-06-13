# OneProduct Agent OS — Chrome Eklentisi

Hermes çok-ajanlı orkestratörünü tarayıcıya taşıyan Manifest V3 eklentisi.
Herhangi bir sayfada açılır pencereden ajanlara soru sorabilir; Trendyol,
Hepsiburada, n11 ve Amazon.com.tr ürün sayfalarında ürünü tek tıkla
analiz ettirebilirsiniz.

## Özellikler

- **Hızlı sohbet** — Popup'tan `POST /api/v1/chat` üzerinden Hermes'e soru
  gönderir; yönetici özeti, güven skoru ve kullanılan araçları gösterir.
- **Ürün algılama** — Pazaryeri ürün sayfalarında başlık + fiyatı çıkarır,
  `product_context` olarak isteğe ekler. Hazır eylemler: fiyat analizi,
  rakip taraması, açıklama yazımı.
- **Backend durum göstergesi** — Üstteki nokta `/health` ile bağlantıyı izler.
- **Ayarlar** — Backend URL ve opsiyonel `X-API-Key` `chrome.storage.sync`'te
  saklanır.

## Kurulum (geliştirici modu)

1. Backend'i çalıştırın:
   ```bash
   cd backend && uvicorn apps.api.main:app --reload --port 8000
   ```
2. `chrome://extensions` → **Geliştirici modu** açık.
3. **Paketlenmemiş öğe yükle** → bu `extension/` klasörünü seçin.
4. Araç çubuğundaki ◆ simgesine tıklayın.

## Mimari

- `background.js` — Service worker. Tüm `fetch` çağrıları burada yapılır;
  `host_permissions` sayesinde MV3 service worker istekleri CORS'tan muaftır,
  bu yüzden backend'in `cors_origins` listesine dokunmaya gerek yoktur.
- `content.js` — Pazaryeri sayfalarından ürün bilgisini DOM seçicileriyle
  çıkarır, popup'ın `getProduct` mesajına yanıt verir.
- `popup.{html,css,js}` — Arayüz; arka plan service worker ile `chrome.runtime`
  mesajlaşması üzerinden konuşur.
- `options.{html,js}` — Backend URL + API anahtarı ayarları.

## Notlar

- Varsayılan backend `http://127.0.0.1:8000`. Farklı bir host kullanırsanız
  `manifest.json` içindeki `host_permissions` listesine ekleyin (aksi halde
  service worker fetch'i CORS hatası alır).
- Backend `GEMINI_API_KEY` olmadan `MockProvider`'a düşer; eklenti bu durumda
  yanıtta **⚠︎ mock/yedek** rozetini gösterir (`llm_degraded`).
- Selektörler pazaryerlerinin DOM yapısı değiştikçe güncellenmelidir
  (`content.js` → `SELECTORS`).
