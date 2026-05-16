"""LLM provider abstraction. Uses google-genai SDK; mock provider when no key."""
from __future__ import annotations

import asyncio
import random
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger
from apps.api.core.observability import LLM_REQUESTS, LLM_TOKENS, get_tracer

log = get_logger(__name__)


@dataclass
class LLMMessage:
    role: str  # "user" | "model" | "assistant" | "system"
    content: str


@dataclass
class LLMResponse:
    text: str
    tokens_used: int = 0
    model: str = ""
    error: str | None = None
    raw: dict[str, Any] = field(default_factory=dict)


class LLMProvider(ABC):
    @abstractmethod
    async def generate(
        self,
        *,
        system: str,
        messages: list[LLMMessage],
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        ...


class GeminiProvider(LLMProvider):
    """Calls Gemini via the official google-genai SDK (async).

    Tries `model` first; on 429/empty/error, falls back through `fallback_models`.
    Concurrency capped via a shared semaphore so multi-agent runs don't burn the
    free-tier RPM budget in parallel.
    """

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-2.5-flash",
        fallback_models: list[str] | None = None,
        max_concurrency: int = 2,
    ) -> None:
        from google import genai

        self.model = model
        self.fallback_models = [m for m in (fallback_models or []) if m and m != model]
        self._client = genai.Client(api_key=api_key)
        self._sem = asyncio.Semaphore(max(1, max_concurrency))

    async def generate(
        self,
        *,
        system: str,
        messages: list[LLMMessage],
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        from google.genai import types

        contents: list[types.Content] = []
        for m in messages:
            role = "model" if m.role in ("model", "assistant") else "user"
            contents.append(
                types.Content(role=role, parts=[types.Part.from_text(text=m.content)])
            )

        config = types.GenerateContentConfig(
            system_instruction=system or None,
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

        models_to_try = [self.model, *self.fallback_models]
        last_error: str | None = None
        for model in models_to_try:
            async with self._sem:
                resp = await self._call_with_retry(model, contents, config)
            if resp.text or resp.error is None:
                return resp
            last_error = resp.error
            if "429" in (resp.error or "") or "RESOURCE_EXHAUSTED" in (resp.error or ""):
                log.info("gemini.fallback_to_next", from_model=model)
                continue
            return resp
        return LLMResponse(text="", error=last_error or "All Gemini models exhausted")

    async def _call_with_retry(self, model: str, contents, config) -> LLMResponse:
        from google.genai import errors as genai_errors

        max_attempts = 2
        tracer = get_tracer()
        for attempt in range(1, max_attempts + 1):
            try:
                with tracer.start_as_current_span(f"llm.gemini.{model}") as span:
                    span.set_attribute("llm.model", model)
                    span.set_attribute("llm.provider", "gemini")
                    response = await self._client.aio.models.generate_content(
                        model=model, contents=contents, config=config,
                    )
                    text = (response.text or "").strip()
                    usage = getattr(response, "usage_metadata", None)
                    tokens = getattr(usage, "total_token_count", 0) or 0
                    span.set_attribute("llm.tokens.total", tokens)
                LLM_REQUESTS.labels(provider="gemini", model=model, status="success").inc()
                if tokens:
                    LLM_TOKENS.labels(provider="gemini", model=model).inc(tokens)
                return LLMResponse(
                    text=text,
                    tokens_used=tokens,
                    model=model,
                    raw=response.to_json_dict() if hasattr(response, "to_json_dict") else {},
                )
            except genai_errors.ClientError as exc:
                status = getattr(exc, "code", None) or getattr(exc, "status_code", None)
                if status == 429 and attempt < max_attempts:
                    delay = _extract_retry_delay(exc) or (2 ** attempt)
                    log.warning(
                        "gemini.rate_limited",
                        attempt=attempt, retry_in_s=delay, model=model,
                    )
                    LLM_REQUESTS.labels(provider="gemini", model=model, status="rate_limited").inc()
                    await asyncio.sleep(min(delay, 20))
                    continue
                log.warning("gemini.client_error", status=status, model=model, error=str(exc)[:200])
                LLM_REQUESTS.labels(provider="gemini", model=model, status="client_error").inc()
                return LLMResponse(text="", error=f"Gemini {status} on {model}: {str(exc)[:200]}")
            except Exception as exc:
                log.exception("gemini.exception", model=model, error=str(exc))
                LLM_REQUESTS.labels(provider="gemini", model=model, status="error").inc()
                return LLMResponse(text="", error=f"Gemini error on {model}: {exc}")
        return LLMResponse(text="", error=f"Gemini retry limit on {model}")


def _extract_retry_delay(exc: Exception) -> float | None:
    """Best-effort parse of retryDelay (e.g. '37s') from Gemini 429 payloads."""
    try:
        details = getattr(exc, "details", None)
        if not details:
            return None
        payload = details if isinstance(details, dict) else {}
        for d in payload.get("error", {}).get("details", []) or []:
            if d.get("@type", "").endswith("RetryInfo"):
                raw = d.get("retryDelay", "")
                if raw.endswith("s"):
                    return float(raw[:-1])
    except Exception:
        return None
    return None


class MockProvider(LLMProvider):
    """Deterministic-ish fake LLM used when no API key is configured."""

    async def generate(
        self,
        *,
        system: str,
        messages: list[LLMMessage],
        temperature: float = 0.7,
        max_tokens: int = 1024,
    ) -> LLMResponse:
        await asyncio.sleep(random.uniform(0.4, 1.2))
        last_user = next((m.content for m in reversed(messages) if m.role != "model"), "")
        canned = (
            f"📊 **Analiz tamamlandı (mock)**\n\n"
            f"Talebinizi aldım — \"{last_user[:80]}\"\n\n"
            f"1. İlgili 3 ajan görevlendirildi\n"
            f"2. Mock tool çağrıları yapıldı\n"
            f"3. Detaylı rapor Tasks sayfasından görülebilir\n\n"
            f"⚠️ Bu cevap MockProvider tarafından üretildi. Gerçek Gemini için GEMINI_API_KEY ayarlayın."
        )
        return LLMResponse(text=canned, model="mock", tokens_used=120)


_provider: LLMProvider | None = None


def get_llm_provider() -> LLMProvider:
    global _provider
    if _provider is not None:
        return _provider
    settings = get_settings()

    if not settings.gemini_api_key:
        _provider = MockProvider()
        log.warning("llm.provider.selected", provider="mock", reason="no_api_key")
        return _provider

    _provider = GeminiProvider(
        settings.gemini_api_key,
        settings.gemini_model,
        fallback_models=settings.gemini_fallback_models,
        max_concurrency=settings.llm_max_concurrency,
    )
    log.info("llm.provider.selected", provider="gemini", primary_model=settings.gemini_model)
    return _provider
