# LLM Provider Layer

**Konum:** `backend/apps/api/core/llm/`

## Provider Soyutlaması
- `provider.py` → `get_llm_provider()`. `LLM_PROVIDER=openrouter` + `OPENROUTER_API_KEY` ile OpenRouter; aksi halde `GEMINI_API_KEY` ile Gemini; ikisi de yoksa `MockProvider`. **Tüm orkestratör/agent kodu bu soyutlamadan geçmek zorunda** — testler networksüz çalışır.
- `image.py` → Gemini image generation (`brand_visual_generator` tool'u tarafından kullanılır). Çıktı `apps/_images/` (gitignored).

## AI Modality Matrix
| Modality   | Provider / tool             | Entry                                          |
|------------|-----------------------------|------------------------------------------------|
| Text       | OpenRouter → Gemini model   | `core/llm/provider.py`                         |
| Vision     | `image_analysis`            | `tools/live/image_analysis.py`                 |
| Image      | `brand_visual_generator`    | `core/llm/image.py`                            |
| Live       | Voice Supervisor            | `routes/voice.py` → `/ws/voice`                |
| Embedding  | pgvector memory             | `core/memory/store.py`                         |

## Env Anahtarları
- `LLM_PROVIDER`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` (metin, önerilen)
- `GEMINI_API_KEY` / `GEMINI_MODEL` (görsel, vision, voice, embedding + metin fallback)

Bkz. [[Environment & API Keys]].
