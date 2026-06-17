# Katkı Rehberi

TicOs'a katkıda bulunduğunuz için teşekkürler. Bu rehber, katkı sürecini
standartlaştırmak için hazırlanmıştır.

## Başlamadan Önce

- Çalışma ortamı kurulumu için [README](README.md) "Kurulum ve Çalıştırma"
  bölümünü izleyin.
- Büyük bir değişiklik planlıyorsanız, önce bir **issue** açarak tartışın.

## Geliştirme Akışı

1. Depoyu fork edin.
2. Bir dal oluşturun: `git checkout -b feature/kisa-aciklama`
3. Değişikliğinizi yapın ve testleri çalıştırın:
   ```bash
   # Backend (backend/ dizininden)
   pytest apps/api/tests -q
   # Tam doğrulama
   scripts/check.sh
   ```
4. Anlamlı bir commit mesajı yazın (örn. `fiyatlandırma ajanına reorder testi ekle`).
5. Dalınızı push edin ve bir **Pull Request** açın.

## Kod Standartları

- **Python:** her modülün başında `from __future__ import annotations`,
  PEP 604 union'ları (`X | None`), değer nesneleri için dataclass.
- **Loglama:** `apps.api.core.logging.get_logger(__name__)` (structlog);
  event adları noktalı küçük harf (`hermes.task.created`).
- **Kullanıcıya görünen metinler Türkçe kalmalıdır.**
- Yeni ajan/araç eklerken `CLAUDE.md` ve `README.md` içindeki sayıları
  güncelleyin.

## Pull Request Beklentileri

- CI (pytest + vite build) yeşil olmalı.
- Davranış değişiklikleri için test ekleyin.
- PR açıklamasında ne/neden bilgisini kısaca belirtin.
