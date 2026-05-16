# OneProduct Dashboard (Blazor Server + SignalR)

İnteraktif, animasyonlu ajan izleme dashboard'u. Mevcut FastAPI backend'i
(`http://localhost:8000`) tüketir. Canlı ajan aktiviteleri SignalR
üzerinden yayınlanır.

## Çalıştırma

Ön koşul: .NET 9 SDK + Runtime. Sadece SDK yüklüyse runtime'ı da kur:

```bash
brew install --cask dotnet-sdk
# veya: https://dotnet.microsoft.com/download/dotnet/9.0
```

Sonra:

```bash
cd apps/dashboard-csharp
dotnet restore
dotnet run
```

Dashboard `https://localhost:5001` (veya konsolda yazan port) üzerinde
açılır. Backend ayrı bir terminalde çalışmalıdır:

```bash
uvicorn apps.api.main:app --reload --port 8000
```

## Özellikler

- **Canlı ajan akışı** (`/`): Ajan kartları SignalR üzerinden anlık güncellenir;
  her durum geçişi animasyonlu (`pulse-border`, `shake`, `blink`, `slide-in`).
- **Ajan rosteri** (`/agents`): Tüm ajanların özet tablosu, ortalama güven barı animasyonlu.
- **Chat strip**: `/api/v1/chat` endpoint'ine Hermes komutu gönderir;
  yanıt fade-in animasyonu ile gelir.
- **Glassmorphism + gradient + radial bg**: Mavi/mor tema, `Inter` font,
  responsive (≤800px sidebar yatay).

## Mimari

- `Program.cs` — Blazor Server + SignalR + typed `HttpClient` kayıtları.
- `Hubs/AgentActivityHub.cs` — `IHubContext<>`; `AgentActivityBroadcaster`
  `BackgroundService` her ~1.5s'de bir backend'i yoklar ve `activity`
  event'i broadcast eder.
- `Services/AgentApiClient.cs` — Tipli FastAPI istemcisi; backend
  ayaktayken liste döner, değilse boş liste (UI bozulmaz).
- `Components/Pages/Home.razor` — `HubConnectionBuilder` ile bağlanır,
  her `activity` mesajında `StateHasChanged` çağırır.
- `wwwroot/css/site.css` — Tüm animasyonlar (keyframes blokunda
  `@@keyframes` çift @ Razor için).

## Production notu

`AgentActivityBroadcaster` şu an demo amaçlı simülasyon yapar. Production'da:
1. FastAPI tarafında bir SSE/WebSocket endpoint'i ekle
   (`/api/v1/events` → her `openclaw.tool.executed` event'inde push).
2. Broadcaster'ı bu kaynaktan beslenecek şekilde değiştir.
