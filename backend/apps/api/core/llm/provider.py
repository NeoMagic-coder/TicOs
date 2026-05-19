"""LLM provider abstraction. Supports Gemini and a mock fallback."""
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
        grounding: list[str] | None = None,
    ) -> LLMResponse:
        """Generate a completion.

        ``grounding`` accepts opaque source ids such as ``"google_search"`` or
        ``"collectapi"``. Providers translate them into native tool configs
        (Gemini's ``Tool(google_search=...)`` / ``Tool(retrieval=...)`` etc.)
        and silently ignore unsupported sources — never raise.
        """
        ...


def _build_gemini_tools(grounding: list[str] | None) -> list[Any]:
    """Translate grounding source ids into ``google.genai.types.Tool`` instances.

    Supported ids:
      * ``"google_search"`` → ``Tool(google_search=GoogleSearch())`` (live web).
      * ``"collectapi"`` / ``"external_api"`` → ``Tool(retrieval=Retrieval(
        external_api=ExternalApi(...)))`` pointing at our
        ``/api/v1/grounding/search`` endpoint. Only attached when the endpoint
        URL is configured via ``GROUNDING_EXTERNAL_API_ENDPOINT`` — Gemini calls
        it from Google's network, so it must be publicly reachable.

    Unknown ids are silently ignored. Returns ``[]`` when nothing is requested.
    """
    if not grounding:
        return []
    try:
        from google.genai import types  # type: ignore
    except Exception:
        return []
    settings = get_settings()
    out: list[Any] = []
    requested = {g.lower() for g in grounding}
    if "google_search" in requested:
        try:
            out.append(types.Tool(google_search=types.GoogleSearch()))
        except Exception as exc:
            log.warning("gemini.tool.google_search_unavailable", error=str(exc))
    if requested & {"collectapi", "external_api"}:
        endpoint = settings.grounding_external_api_endpoint
        api_key = settings.grounding_external_api_key
        if endpoint:
            try:
                external = types.ExternalApi(
                    api_spec="SIMPLE_SEARCH",
                    endpoint=endpoint,
                    api_auth={
                        "apiKeyConfig": {"apiKeyString": api_key or ""}
                    } if api_key else None,
                )
                out.append(types.Tool(retrieval=types.Retrieval(external_api=external)))
            except Exception as exc:
                log.warning("gemini.tool.external_api_unavailable", error=str(exc))
        else:
            log.info(
                "gemini.tool.external_api_skipped",
                reason="grounding_external_api_endpoint not configured",
            )
    return out


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
        self._mock_fallback = MockProvider()
        # Sticky flag — last call fell back to mock due to quota. Cleared as
        # soon as a real Gemini call succeeds, so the UI badge auto-recovers.
        self.last_call_degraded: bool = False
        self.last_call_degraded_reason: str | None = None

    async def generate(
        self,
        *,
        system: str,
        messages: list[LLMMessage],
        temperature: float = 0.7,
        max_tokens: int = 1024,
        grounding: list[str] | None = None,
    ) -> LLMResponse:
        from google.genai import types

        contents: list[types.Content] = []
        for m in messages:
            role = "model" if m.role in ("model", "assistant") else "user"
            contents.append(
                types.Content(role=role, parts=[types.Part.from_text(text=m.content)])
            )

        tools = _build_gemini_tools(grounding)
        # Grounding tools are incompatible with ``system_instruction`` on some
        # models; we keep them together because gemini-2.5-flash accepts both.
        config = types.GenerateContentConfig(
            system_instruction=system or None,
            temperature=temperature,
            max_output_tokens=max_tokens,
            tools=tools or None,
        )

        models_to_try = [self.model, *self.fallback_models]
        last_error: str | None = None
        for model in models_to_try:
            async with self._sem:
                resp = await self._call_with_retry(model, contents, config)
            if resp.text or resp.error is None:
                # Real Gemini call landed — clear sticky degraded flag.
                self.last_call_degraded = False
                self.last_call_degraded_reason = None
                return resp
            last_error = resp.error
            if "429" in (resp.error or "") or "RESOURCE_EXHAUSTED" in (resp.error or ""):
                log.info("gemini.fallback_to_next", from_model=model)
                continue
            return resp
        # All Gemini models exhausted (quota / 429). Degrade gracefully to the
        # mock provider so the user gets a usable, clearly-marked answer instead
        # of a FAILED task. The error is preserved on the response for the UI.
        is_quota = bool(last_error) and ("429" in last_error or "RESOURCE_EXHAUSTED" in last_error or "quota" in last_error.lower())
        if is_quota:
            log.warning("gemini.quota_exhausted_fallback_mock", error=last_error)
            mock_resp = await self._mock_fallback.generate(
                system=system, messages=messages, temperature=temperature, max_tokens=max_tokens,
            )
            mock_resp.error = last_error
            mock_resp.model = "mock(quota-fallback)"
            mock_resp.raw = {**(mock_resp.raw or {}), "degraded": True, "reason": "gemini_quota_exhausted"}
            self.last_call_degraded = True
            self.last_call_degraded_reason = "gemini_quota_exhausted"
            return mock_resp
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
                raw_payload = response.to_json_dict() if hasattr(response, "to_json_dict") else {}
                # Surface groundingMetadata (web queries + grounding chunks) so
                # the UI can render sources. Lives under candidates[0].
                grounding_meta = _extract_grounding_metadata(raw_payload)
                if grounding_meta:
                    raw_payload["grounding_metadata"] = grounding_meta
                return LLMResponse(
                    text=text,
                    tokens_used=tokens,
                    model=model,
                    raw=raw_payload,
                )
            except genai_errors.ClientError as exc:
                status = getattr(exc, "code", None) or getattr(exc, "status_code", None)
                err_str = str(exc)
                # Free-tier quota (limit: 0) is permanent for the day — don't
                # waste 13-20s sleeping. Bail out immediately so the caller
                # can move to the next fallback model or fall through to mock.
                is_free_tier_zero = "limit: 0" in err_str or "FreeTier" in err_str
                if status == 429 and attempt < max_attempts and not is_free_tier_zero:
                    delay = _extract_retry_delay(exc) or (2 ** attempt)
                    log.warning(
                        "gemini.rate_limited",
                        attempt=attempt, retry_in_s=delay, model=model,
                    )
                    LLM_REQUESTS.labels(provider="gemini", model=model, status="rate_limited").inc()
                    await asyncio.sleep(min(delay, 8))
                    continue
                log.warning("gemini.client_error", status=status, model=model, error=err_str[:200])
                LLM_REQUESTS.labels(provider="gemini", model=model, status="client_error").inc()
                return LLMResponse(text="", error=f"Gemini {status} on {model}: {str(exc)[:200]}")
            except Exception as exc:
                log.exception("gemini.exception", model=model, error=str(exc))
                LLM_REQUESTS.labels(provider="gemini", model=model, status="error").inc()
                return LLMResponse(text="", error=f"Gemini error on {model}: {exc}")
        return LLMResponse(text="", error=f"Gemini retry limit on {model}")


def _extract_grounding_metadata(raw: dict[str, Any]) -> dict[str, Any] | None:
    """Pluck Gemini's groundingMetadata from the candidate envelope.

    Returns a normalized dict::

        {
          "queries": ["Türkiye nüfusu 2026", ...],
          "sources": [{"uri": "...", "title": "..."}, ...]
        }

    Returns ``None`` when the response was not grounded.
    """
    try:
        candidates = raw.get("candidates") or []
        if not candidates:
            return None
        meta = candidates[0].get("grounding_metadata") or candidates[0].get("groundingMetadata")
        if not meta:
            return None
        queries = meta.get("web_search_queries") or meta.get("webSearchQueries") or []
        chunks = meta.get("grounding_chunks") or meta.get("groundingChunks") or []
        sources: list[dict[str, str]] = []
        for chunk in chunks:
            web = chunk.get("web") if isinstance(chunk, dict) else None
            if not web:
                continue
            uri = web.get("uri") or ""
            title = web.get("title") or uri
            if uri:
                sources.append({"uri": uri, "title": title})
        if not queries and not sources:
            return None
        return {"queries": list(queries), "sources": sources}
    except Exception:
        return None


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
    """Deterministic-ish fake LLM used when no API key is configured.

    Always tags the response with `raw.degraded = True` and a reason so the
    UI can render a persistent "mock" badge — without this, the canned text
    is easy to mistake for a real Gemini answer.
    """

    async def generate(
        self,
        *,
        system: str,
        messages: list[LLMMessage],
        temperature: float = 0.7,
        max_tokens: int = 1024,
        grounding: list[str] | None = None,
    ) -> LLMResponse:
        del grounding  # no-op for the mock provider
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
        return LLMResponse(
            text=canned,
            model="mock",
            tokens_used=120,
            raw={"degraded": True, "reason": "no_api_key"},
        )


_provider: LLMProvider | None = None


def get_llm_provider() -> LLMProvider:
    """Return the configured LLM provider (singleton).

    Selection order:
    1. Explicit ``LLM_PROVIDER`` env var ("gemini" | "mock")
    2. Auto-detect: Gemini if ``GEMINI_API_KEY`` is set, else MockProvider.
    """
    global _provider
    if _provider is not None:
        return _provider
    settings = get_settings()

    explicit = (settings.llm_provider or "").lower().strip()
    use_gemini = explicit == "gemini" or (not explicit and bool(settings.gemini_api_key))

    if use_gemini:
        if not settings.gemini_api_key:
            log.warning("llm.provider.fallback_mock", reason="gemini_key_missing")
            _provider = MockProvider()
        else:
            _provider = GeminiProvider(
                settings.gemini_api_key,
                settings.gemini_model,
                fallback_models=settings.gemini_fallback_models,
                max_concurrency=settings.llm_max_concurrency,
            )
            log.info("llm.provider.selected", provider="gemini", primary_model=settings.gemini_model)
    else:
        _provider = MockProvider()
        log.warning("llm.provider.selected", provider="mock", reason="no_api_key")

    return _provider
