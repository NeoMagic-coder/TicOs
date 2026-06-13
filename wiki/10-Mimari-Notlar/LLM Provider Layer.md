# LLM Provider Layer

**Konum:** `backend/apps/api/core/llm/`

## Provider Soyutlaması
- `provider.py` → `get_llm_provider()`. `GEMINI_API_KEY` set ise Gemini, değilse `MockProvider`. **Tüm orkestratör/agent kodu bu soyutlamadan geçmek zorunda** — testler bu sayede networksüz çalışır.
- `image.py` → Gemini image generation (`brand_visual_generator` tool'u tarafından kullanılır). Çıktı `apps/_images/` (gitignored).

## AI Modality Matrix
| Modality   | Provider / tool             | Entry                                          |
|------------|-----------------------------|------------------------------------------------|
| Text       | Gemini 2.5 Flash Lite       | `core/llm/provider.py`                         |
| Vision     | `image_analysis`            | `tools/live/image_analysis.py`                 |
| Image      | `brand_visual_generator`    | `core/llm/image.py`                            |
| Live       | Voice Supervisor            | `routes/voice.py` → `/ws/voice`                |
| Embedding  | pgvector memory             | `core/memory/store.py`                         |

## Env Anahtarları
- `GEMINI_API_KEY` / `GEMINI_MODEL` (backend)
- `VITE_GEMINI_API_KEY` / `VITE_GEMINI_MODEL` (frontend doğrudan tarayıcıdan da çağırabiliyor)

Bkz. [[Environment & API Keys]].
