# Ticosclaw Kurulum Rehberi

Bu rehber, uygulamanın tam çalışması için gerekli ortam değişkenlerini ve adım adım kurulumu açıklar.

## Hızlı başlangıç

```powershell
cd web
npm install
npm run setup          # .env.local oluşturur (.env.example'dan)
npm run setup:check    # hangi key'lerin eksik olduğunu gösterir
```

Ardından aşağıdaki key'leri `.env.local` dosyasına ekleyin ve tekrar `npm run setup:check` çalıştırın.

```powershell
npm run dev
```

Tarayıcı: [http://localhost:3000/tr/dashboard](http://localhost:3000/tr/dashboard)

---

## Zorunlu değişkenler

### 1. Clerk — Kimlik doğrulama

| Değişken | Açıklama |
|----------|----------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_...` |
| `CLERK_SECRET_KEY` | `sk_test_...` |

Bunlar olmadan uygulama **demo modunda** çalışır (`src/lib/auth/config.ts` ve `middleware.ts` bu key'in varlığına bakıyor). Daha önce aldığınız `Missing publishableKey` hatasının sebebi tam olarak budur.

**Key alma — Seçenek A (önerilen, CLI):**

```powershell
cd web
npx clerk@1.5.0 auth login    # tarayıcıda Clerk hesabına giriş
npx clerk@1.5.0 init          # projeyi bağla ve .env.local'e key'leri yaz
npx clerk@1.5.0 doctor        # doğrula
```

**Key alma — Seçenek B (manuel):**

1. [dashboard.clerk.com](https://dashboard.clerk.com) üzerinden uygulama oluşturun
2. **API Keys** bölümünden Publishable ve Secret key'leri kopyalayın
3. Clerk Dashboard'da redirect URL'leri ayarlayın:
   - Sign-in: `http://localhost:3000/tr/sign-in`
   - Sign-up: `http://localhost:3000/tr/sign-up`
   - After sign-in: `http://localhost:3000/tr/dashboard`
   - After sign-up: `http://localhost:3000/tr/onboarding`

URL ayarları `.env.example` içinde zaten dolu — değiştirmeniz gerekmez:

```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/tr/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/tr/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/tr/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/tr/onboarding
```

### 2. Supabase — Veritabanı

| Değişken | Açıklama |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` veya klasik `eyJ...` anon key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (opsiyonel alias) publishable yoksa kullanılır |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service role — **gizli**) |

SSR client dosyaları: `src/lib/supabase/server.ts`, `browser.ts`, `middleware.ts`

`src/lib/supabase/client.ts` bu değişkenleri kullanır. Production'da `SERVICE_ROLE_KEY` yoksa hata fırlatır.

**Kurulum adımları:**

1. [supabase.com/dashboard](https://supabase.com/dashboard) → yeni proje oluşturun
2. **Project Settings → API** bölümünden URL, anon key ve service role key'i kopyalayın
3. **SQL Editor**'da `supabase/migrations/001_initial_schema.sql` dosyasının içeriğini çalıştırın

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` gizlidir — `NEXT_PUBLIC_` öneki **yok**, sadece sunucu tarafında kalır, asla client'a sızdırmayın.

### 3. OpenAI — AI özellikleri (önerilen)

| Değişken | Açıklama |
|----------|----------|
| `OPENAI_API_KEY` | `sk-...` |

Chat, marka analizi (`brand-analyzer.ts`), görsel üretimi (`image-generator.ts`) ve chat route'u kullanır. Key yoksa bu özellikler çalışmaz; uygulama çökmez.

Key: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

---

## Opsiyonel değişkenler

Yoksa ilgili özellik devre dışı kalır; uygulama çökmez.

```env
# Marka sitesi taraması
FIRECRAWL_API_KEY=

# Sosyal medya OAuth (yoksa "demo" fallback)
INSTAGRAM_CLIENT_ID=
INSTAGRAM_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
LINKEDIN_CLIENT_ID=
GMAIL_CLIENT_ID=
OUTLOOK_CLIENT_ID=
WORDPRESS_CLIENT_ID=
REDDIT_CLIENT_ID=
```

Entegrasyon route'u (`api/integrations/[platform]/route.ts`) key yoksa `"demo"` değeriyle devam eder — test için boş bırakabilirsiniz.

---

## Öncelik özeti

| Öncelik | Değişken grubu | Neden |
|---------|----------------|-------|
| 🔴 Şart | Clerk (2 key) | Auth çalışmaz, demo moda düşer |
| 🔴 Şart | Supabase (3 key) | Veri katmanı |
| 🟡 Önerilen | OpenAI | AI özellikleri |
| ⚪ Opsiyonel | Firecrawl + OAuth | İlgili özellikler |

**Minimum kurulum:** Clerk (2) + Supabase (3) + OpenAI (1)

---

## Güvenlik notları

- `.env.local` zaten `.gitignore`'da (`.env.*`) — commit'lenmez, doğru.
- `NEXT_PUBLIC_` önekli değişkenler tarayıcıya gider.
- Gizli anahtarları (`CLERK_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`) **asla** `NEXT_PUBLIC_` önekiyle yazmayın.

---

## Sorun giderme

| Sorun | Çözüm |
|-------|-------|
| `Missing publishableKey` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` boş — Clerk key'lerini ekleyin |
| Demo kullanıcı görünüyor | Clerk key'leri eksik veya hatalı |
| Supabase bağlantı hatası | URL ve key'leri kontrol edin; migration çalıştırıldı mı? |
| AI yanıt vermiyor | `OPENAI_API_KEY` eksik veya geçersiz |

Daha fazla Clerk detayı: [CLERK_SETUP.md](./CLERK_SETUP.md)
