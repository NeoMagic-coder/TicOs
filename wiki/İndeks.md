# 🗺️ TicOs — Wiki İndeks

> Bu dosya, projenin tüm mimari haritasının merkezî giriş noktasıdır. Yeni özellik planlarken önce buradan ilgili node'a atla.

## 🧭 Proje Özeti
- **TicOs** (TicOsClaw) — tek ürün etrafında dönen, çok-ajanlı e-ticaret platformu.
- İki ana katman: **Hermes** (orkestratör) + **OpenClaw** (tool-use).
- Dil: Türkçe (UI, prompt, summary). Backend FastAPI / Frontend Vite+React 19.
- Detay özeti: [[Proje Genel Bakış]]

## 🏛️ Çekirdek Mimari Katmanlar
- [[Hermes Orkestratör]] — Request → Route → Plan → DAG → Merge.
- [[OpenClaw Tool Layer]] — Manifest registry, permission, schema validation, circuit breaker.
- [[Agent Katmanı]] — 23 ajan, 4 autonomy ajanı, CriticAgent skorlama.
- [[Tool Manifest Registry]] — 18 manifest dosyası, 101 tool (60 live + 41 mock).
- [[Autonomy Layer]] — Decision engine, negotiation, coordination, goals.
- [[Commerce Control Layer]] — AI e-ticaret modül kontrolü (ürün, stok, sipariş, fraud).
- [[Agent Mesaj Veriyolu (A2A)]] — A2A pub/sub bus + `agent_handoff` tool.
- [[Paperclip Layer]] — Org chart, goal tree, per-agent budget.
- [[LLM Provider Layer]] — Gemini + MockProvider fallback.
- [[Memory Layer]] — pgvector cosine similarity.
- [[Observability]] — OpenTelemetry + Prometheus.

## 🌐 API Yüzeyi
- [[Backend API Routes]] — chat, agents, tools, org, goals, budgets, voice WS.
- [[SSE & Voice Streaming]] — `/api/v1/chat/stream`, `/ws/voice`.

## 🎨 Frontend
- [[Frontend Mimarisi]] — Zustand store, sayfa listesi, Layout.
- [[Frontend Sayfalar]] — 21 aktif page bileşeni (+ placeholder route'lar).
- [[Frontend API Katmanı]] — `chatWithFallback`, `sendUserMessageStream`, `detectIntent`.

## 🛠️ Geliştirme & Operasyon
- [[Komutlar & Dev Akışı]] — `scripts/dev.sh`, `scripts/check.sh`, Nix.
- [[Test Stratejisi]] — pytest-asyncio + Playwright e2e.
- [[Environment & API Keys]] — `.env.local`, Gemini key fallback.

## 📦 Aktif Projeler
- [[Agent-Iletisim-ve-Otonom-Calisma]] — A2A bus + otonom döngü (Faz 1 ✅ tamam).
- [[AutoResearch-Tasarimi]] — Karpathy tarzı otonom araştırma/optimizasyon döngüsü (Tamamlandı ✅).

## 🧠 LLM Wiki (Karpathy Vault)
- [[index]] — Kavram/entity/source kataloğu (`wiki/index.md`).
- [[log]] — Ingest/query/lint işlem günlüğü.
- [[concepts/LLM Wiki]] — Kalıcı bilgi tabanı yaklaşımı.
- [[LLM-WIKI-AGENTS]] — Agent şeması ve operasyon kuralları.
- `raw/` — Değişmez ham kaynak katmanı (repo kökü).
- [[START HERE]] — Obsidian vault hızlı başlangıç (repo kökü).

---
_Son senkronizasyon: 2026-06-13 (kod tabanı ingest — sayımlar, TicOs markası, eksik sayfalar)._
