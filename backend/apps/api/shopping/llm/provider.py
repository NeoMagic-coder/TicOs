"""LLM saglayici soyutlamasi — OpenAI (gpt-4o), Ollama (llama3) veya Mock.

Tum ajan kodu get_llm_provider() uzerinden gider; anahtar yoksa mock'a duser,
boylece akis hicbir zaman LLM yuzunden durmaz (akis kisiti 1).
"""

from __future__ import annotations

import logging
from typing import Protocol

import httpx

from apps.api.shopping.config import Settings, get_settings

logger = logging.getLogger(__name__)

_TIMEOUT_SECONDS = 60.0


class LLMProvider(Protocol):
    name: str

    async def complete(self, system: str, user: str) -> str: ...


class MockLLMProvider:
    """Ag erisimi olmadan deterministik yanit — testler ve anahtarsiz calisma icin."""

    name = "mock"

    def __init__(self, canned: str = '{"offers": []}') -> None:
        self._canned = canned

    async def complete(self, system: str, user: str) -> str:
        return self._canned


class OpenAIProvider:
    name = "openai"

    def __init__(self, api_key: str, model: str = "gpt-4o") -> None:
        self._api_key = api_key
        self._model = model

    async def complete(self, system: str, user: str) -> str:
        async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "model": self._model,
                    "temperature": 0,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]


class OllamaProvider:
    name = "ollama"

    def __init__(self, base_url: str, model: str = "llama3") -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model

    async def complete(self, system: str, user: str) -> str:
        async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
            resp = await client.post(
                f"{self._base_url}/api/chat",
                json={
                    "model": self._model,
                    "stream": False,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                },
            )
            resp.raise_for_status()
            return resp.json()["message"]["content"]


class CoreLLMBridge:
    """Routes shopping prompts through the main TicOSClaw LLM stack (Bedrock/Gemini/mock)."""

    name = "bedrock"

    async def complete(self, system: str, user: str) -> str:
        from apps.api.core.llm.provider import LLMMessage, get_llm_provider

        result = await get_llm_provider().generate(
            system=system,
            messages=[LLMMessage(role="user", content=user)],
            temperature=0,
            max_tokens=4096,
        )
        if result.error:
            raise RuntimeError(result.error)
        return result.text or ""


def get_llm_provider(settings: Settings | None = None) -> LLMProvider:
    settings = settings or get_settings()
    if settings.llm_provider == "bedrock":
        return CoreLLMBridge()
    if settings.llm_provider == "openai":
        if not settings.openai_api_key:
            logger.warning("llm.no_api_key provider=openai — mock saglayiciya dusuluyor")
            return MockLLMProvider()
        return OpenAIProvider(settings.openai_api_key, settings.openai_model)
    if settings.llm_provider == "ollama":
        return OllamaProvider(settings.ollama_base_url, settings.ollama_model)
    return MockLLMProvider()

