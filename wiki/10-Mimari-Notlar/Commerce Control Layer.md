# Commerce Control Layer

**Konum:** `backend/apps/api/core/commerce/`, `routes/commerce_control.py`, `frontend/src/pages/CommerceControlPage.tsx`

## Amaç

E-ticaret modüllerini (ürün, stok, sipariş, ödeme, destek, dolandırıcılık) tek bir yapay zeka kontrol katmanı altında birleştirir. Hermes/ajan katmanı ile TIC envanter/sipariş verisi arasında politika güdümlü köprü görevi görür.

## Mimari

```
[Kullanıcı / Supervisor / Fraud Agent]
        ↕
[Commerce Control API]  /api/v1/commerce/control/*
        ↕
[CommerceControlOrchestrator]
   ├── analyzers (6 modül)
   ├── action_registry → DecisionEngine → ApprovalStore
   └── policy (eşikler, sınırlamalar)
        ↕
[TIC DB] + [Task/Approval Store] + [OpenClaw tools]
```

## Modüller ve AI Teknikleri

| Modül | Teknik | Otomasyon |
|-------|--------|-----------|
| Ürün Yönetimi | NLP, görüntü analizi | Öneri |
| Stok Takibi | Tahmine dayalı analitik | Uyarı |
| Sipariş Yönetimi | Kural + tahmin | Öneri |
| Ödeme İşleme | Anomali tespiti | İzleme |
| Müşteri Desteği | NLP, duygu analizi | Öneri |
| Dolandırıcılık | Davranışsal skorlama | Uyarı |

## API

- `GET /commerce/control/snapshot` — birleşik sağlık raporu
- `POST /commerce/control/scan` — zorunlu yeniden tarama
- `GET /commerce/control/modules` — özet modül listesi
- `GET/PATCH /commerce/control/policy` — eşik ayarları
- `POST /commerce/control/actions/propose` — aksiyon öner + onay kuyruğu
- `GET /commerce/control/limitations` — bilinen sınırlamalar

## Ajanlar ve Araçlar

- **fraud_agent** — `commerce_control_scan`, `commerce_fraud_check`, `commerce_action_propose`
- Manifest: `tools/manifests/commerce_control.json` (3 live tool)

## Entegrasyon

- `product_bridge.get_workspace_integration_status()` → `modules.commerce_control`
- Integration flow pipeline'a **AI Kontrol** düğümü eklendi
- UI: TicOSClaw hub → **AI Kontrol** (`commerce_control`)

## Bilinen Sınırlamalar

- Dolandırıcılık skoru kural tabanlıdır; yanlış pozitif mümkündür
- Destek modülü gerçek ticket CRM'i olmadan görev/onay sinyallerine dayanır
- Stok tahmini geçmiş veriye bağlıdır; ani kampanyalar bozar
- Ödeme kararları ödeme sağlayıcısı kurallarına tabidir

## İlgili

- [[Autonomy Layer]], [[Agent Katmanı]], [[Backend API Routes]], [[Frontend Sayfalar]]
