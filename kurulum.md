# Ticosclaw Kurulum

Detaylı Türkçe kurulum rehberi: **[web/KURULUM.md](web/KURULUM.md)**

## Hızlı özet

```powershell
cd web
npm install
npm run setup
# .env.local dosyasına key'leri ekleyin (Clerk, Supabase, OpenAI)
npm run setup:check
npm run dev
```

## Minimum gerekli key'ler

| Öncelik | Servis | Değişken sayısı |
|---------|--------|-----------------|
| 🔴 Zorunlu | Clerk | 2 |
| 🔴 Zorunlu | Supabase | 3 |
| 🟡 Önerilen | OpenAI | 1 |

Key'ler olmadan uygulama demo modunda çalışır; tam işlevsellik için yukarıdakiler gereklidir.
