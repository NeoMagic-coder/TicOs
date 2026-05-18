# OneProduct Agent OS

![Autonomy Console DAG](docs/autonomy-console.gif)

> 22 uzman ajan, 90 araç, Gemini ile tam otonom e-ticaret.

[![Demo Video](https://img.youtube.com/vi/XXXXXX/0.jpg)](https://youtu.be/XXXXXX)

## 🤖 AI Modaliteleri

| Modalite   | Sağlayıcı / Araç              | Nerede                                                                |
|------------|-------------------------------|-----------------------------------------------------------------------|
| Text       | Gemini 2.5 Flash Lite         | `apps/api/core/llm/provider.py` — tüm ajanlar & merge                 |
| Vision     | `image_analysis`              | `apps/api/tools/live/` — ürün görseli & rakip teardown                |
| Image      | `brand_visual_generator`      | `apps/api/core/llm/image.py` — marka kimliği & lansman görselleri     |
| Live       | Voice Supervisor              | `apps/api/routes/voice.py` — `/ws/voice` (Gemini Live + intent dispatch) |
| Embedding  | pgvector memory               | `apps/api/core/memory/store.py` — `memory_search` / `knowledge_search` |

## 🚀 Hızlı Başlangıç (3 komut)
```bash
git clone ...
docker-compose up
# localhost:5173
```

## 🎬 Demo Senaryosu (60 sn)

[Link to demo video](https://youtu.be/XXXXXX)

## 🏗️ Mimari

![Mimari](docs/architecture.png)

## 📈 ROI

3 saatte 47 karar, +%18.4 brüt kâr, $0.41 Gemini maliyeti.

## 🛠️ Testler

```bash
pytest tests/ -v
npx playwright test
```

## 📄 Whitepaper

[docs/whitepaper/paper.pdf](docs/whitepaper/paper.pdf)
