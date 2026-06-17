"""MockProvider fallback smoke test.

`GEMINI_API_KEY` ayarlı değilken (veya `MOCK_PROVIDER=true`) backend'in
``MockProvider``'a düştüğünü ve ``generate()`` çağrısının deterministik bir
yanıt ürettiğini doğrular. Hackathon kontrolünde Gemini quota'sı tükendiğinde
sistemin sessizce mock'a düşeceğini garanti etmek için.

Çalıştırma:
    python scripts/test_mock_fallback.py
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

# Provider seçiminin mock olduğundan emin ol. Backend `LLM_PROVIDER=mock`
# env'ine bakar — backup.env'deki `MOCK_PROVIDER=true` sentinel'i de aynı
# anlamda set ediyoruz, hangi koda dokunulursa dokunulsun.
os.environ.pop("GEMINI_API_KEY", None)
os.environ.pop("OPENROUTER_API_KEY", None)
os.environ["LLM_PROVIDER"] = "mock"
os.environ["MOCK_PROVIDER"] = "true"


async def main() -> int:
    try:
        from apps.api.core.llm.provider import (
            LLMMessage,
            MockProvider,
            get_llm_provider,
        )
    except Exception as exc:  # pragma: no cover
        print(f"FAIL: import error — {exc}")
        return 1

    provider = get_llm_provider()
    if not isinstance(provider, MockProvider):
        print(f"FAIL: provider is {type(provider).__name__}, expected MockProvider")
        return 1

    try:
        result = await provider.generate(
            system="Sen test ediliyorsun.",
            messages=[LLMMessage(role="user", content="merhaba, sistemi test ediyorum")],
        )
    except Exception as exc:
        print(f"FAIL: generate() raised — {exc}")
        return 1

    text = getattr(result, "content", None) or getattr(result, "text", None) or str(result)
    if not text or not str(text).strip():
        print("FAIL: MockProvider returned empty content")
        return 1

    print("OK: MockProvider active and produced non-empty content")
    print(f"     preview: {str(text)[:120]!r}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
