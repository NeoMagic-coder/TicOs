"""OpenRouter provider contract tests. No live network calls."""
from __future__ import annotations

import json

import httpx
import pytest
from fastapi import HTTPException

from apps.api.core.config import Settings, get_settings
from apps.api.core.db.models import AgentLLMConfigRow
from apps.api.core.llm import per_agent
from apps.api.core.llm import provider as provider_mod
from apps.api.core.llm.provider import (
    LLMMessage,
    LLMProvider,
    LLMResponse,
    OpenRouterProvider,
)
from apps.api.models.schemas import AgentLLMConfigUpdate
from apps.api.routes.agents import _row_to_llm_config, put_agent_llm_config
from apps.api.routes.llm import list_providers


class _FallbackProvider(LLMProvider):
    def __init__(self) -> None:
        self.calls = 0

    async def generate(
        self, *, system, messages, temperature=0.7, max_tokens=1024, grounding=None,
    ) -> LLMResponse:
        self.calls += 1
        return LLMResponse(text="fallback yanıtı", model="fallback", provider="gemini")


def _client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.mark.asyncio
async def test_complete_compatibility_wrapper_returns_content() -> None:
    provider = _FallbackProvider()

    response = await provider.complete([LLMMessage(role="user", content="ping")])

    assert response.content == "fallback yanıtı"
    assert provider.calls == 1


@pytest.mark.asyncio
async def test_openrouter_success_uses_secure_routing_and_tracks_cost() -> None:
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(
            200,
            json={
                "id": "gen_123",
                "model": "google/gemini-2.5-flash-lite",
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": "Analiz hazır.",
                        "annotations": [{
                            "type": "url_citation",
                            "url_citation": {
                                "url": "https://example.com/source",
                                "title": "Kaynak",
                            },
                        }],
                    },
                }],
                "usage": {"total_tokens": 42, "cost": 0.00125},
            },
        )

    provider = OpenRouterProvider(
        "sk-or-test",
        "google/gemini-2.5-flash-lite",
        fallback_models=["openrouter/auto"],
        site_url="https://oneproduct.example",
        client=_client(handler),
    )
    result = await provider.generate(
        system="Türkçe cevap ver.",
        messages=[LLMMessage(role="user", content="Pazar araştırması yap")],
        grounding=["google_search"],
    )

    assert result.text == "Analiz hazır."
    assert result.provider == "openrouter"
    assert result.tokens_used == 42
    assert result.cost_usd == pytest.approx(0.00125)
    assert result.request_id == "gen_123"
    assert result.raw["grounding_metadata"]["sources"][0]["uri"] == "https://example.com/source"

    request = captured[0]
    payload = json.loads(request.content)
    assert request.headers["Authorization"] == "Bearer sk-or-test"
    assert request.headers["HTTP-Referer"] == "https://oneproduct.example"
    assert payload["models"] == ["google/gemini-2.5-flash-lite", "openrouter/auto"]
    assert payload["provider"]["zdr"] is True
    assert payload["provider"]["data_collection"] == "deny"
    assert payload["provider"]["require_parameters"] is True
    assert payload["provider"]["max_price"] == {"prompt": 1.0, "completion": 3.0}
    assert payload["max_tokens"] == 1024
    assert "max_completion_tokens" not in payload
    # Web search is enabled via OpenRouter's ``plugins`` field, not ``tools``.
    assert payload["plugins"][0]["id"] == "web"
    assert "tools" not in payload


@pytest.mark.asyncio
async def test_openrouter_retries_429_then_succeeds(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = 0

    async def no_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr(provider_mod.asyncio, "sleep", no_sleep)

    def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(
                429,
                headers={"Retry-After": "1"},
                json={"error": {"code": 429, "message": "rate limited"}},
            )
        return httpx.Response(
            200,
            json={
                "id": "gen_retry",
                "model": "openrouter/auto",
                "choices": [{"message": {"content": "tamam"}}],
                "usage": {"total_tokens": 3, "cost": 0.0},
            },
        )

    provider = OpenRouterProvider("sk-or-test", client=_client(handler))
    result = await provider.generate(
        system="",
        messages=[LLMMessage(role="user", content="ping")],
    )

    assert result.text == "tamam"
    assert calls == 2


@pytest.mark.asyncio
async def test_openrouter_transient_failure_falls_back(monkeypatch: pytest.MonkeyPatch) -> None:
    async def no_sleep(_seconds: float) -> None:
        return None

    monkeypatch.setattr(provider_mod.asyncio, "sleep", no_sleep)
    fallback = _FallbackProvider()
    provider = OpenRouterProvider(
        "sk-or-test",
        fallback_provider=fallback,
        client=_client(lambda _request: httpx.Response(
            503,
            json={"error": {"code": 503, "message": "no provider available"}},
        )),
    )

    result = await provider.generate(
        system="",
        messages=[LLMMessage(role="user", content="ping")],
    )

    assert result.text == "fallback yanıtı"
    assert fallback.calls == 1
    assert result.raw["degraded"] is True
    assert result.raw["reason"] == "openrouter_unavailable"
    assert provider.last_call_degraded is True


@pytest.mark.asyncio
async def test_openrouter_guardrail_error_does_not_fallback() -> None:
    fallback = _FallbackProvider()
    provider = OpenRouterProvider(
        "sk-or-test",
        fallback_provider=fallback,
        client=_client(lambda _request: httpx.Response(
            200,
            json={"error": {"code": "403", "message": "prompt injection blocked"}},
        )),
    )

    result = await provider.generate(
        system="",
        messages=[LLMMessage(role="user", content="ping")],
    )

    assert result.text == ""
    assert "403" in (result.error or "")
    assert fallback.calls == 0


@pytest.mark.asyncio
async def test_global_provider_selects_openrouter(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = Settings(
        llm_provider="openrouter",
        openrouter_api_key="sk-or-test",
        gemini_api_key="",
    )
    previous = provider_mod._provider
    monkeypatch.setattr(provider_mod, "get_settings", lambda: settings)
    provider_mod._provider = None
    try:
        provider = provider_mod.get_llm_provider()
        assert isinstance(provider, OpenRouterProvider)
        assert provider.model == settings.openrouter_model
        await provider._client.aclose()
    finally:
        provider_mod._provider = previous


@pytest.mark.asyncio
async def test_per_agent_openrouter_ignores_row_base_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    get_settings.cache_clear()  # type: ignore[attr-defined]
    row = AgentLLMConfigRow(
        agent_id="pricing_agent",
        provider="openrouter",
        model="openrouter/auto",
        base_url="http://169.254.169.254/latest/meta-data",
        api_key_env="OPENROUTER_API_KEY",
        enabled=True,
    )

    provider = per_agent._build(row)
    assert isinstance(provider, OpenRouterProvider)
    assert provider.base_url == get_settings().openrouter_base_url.rstrip("/")
    assert provider.base_url != row.base_url
    await provider._client.aclose()
    get_settings.cache_clear()  # type: ignore[attr-defined]


def test_per_agent_rejects_unrelated_secret_env() -> None:
    row = AgentLLMConfigRow(
        agent_id="pricing_agent",
        provider="openrouter",
        model="openrouter/auto",
        api_key_env="DATABASE_URL",
        enabled=True,
    )

    assert per_agent._build(row) is None


def test_agent_config_does_not_probe_unrelated_secret_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://secret")
    row = AgentLLMConfigRow(
        agent_id="pricing_agent",
        provider="openrouter",
        model="openrouter/auto",
        api_key_env="DATABASE_URL",
        enabled=True,
    )

    assert _row_to_llm_config(row).api_key_present is False


@pytest.mark.asyncio
async def test_provider_catalog_exposes_openrouter() -> None:
    providers = {provider.id: provider for provider in await list_providers()}

    assert providers["openrouter"].default_api_key_env == "OPENROUTER_API_KEY"
    assert providers["openrouter"].requires_base_url is False


@pytest.mark.asyncio
async def test_agent_config_rejects_unrelated_secret_env() -> None:
    with pytest.raises(HTTPException) as exc:
        await put_agent_llm_config(
            "pricing_agent",
            AgentLLMConfigUpdate(
                provider="openrouter",
                model="openrouter/auto",
                api_key_env="DATABASE_URL",
                enabled=True,
            ),
        )

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_agent_config_rejects_openrouter_base_url_override() -> None:
    with pytest.raises(HTTPException) as exc:
        await put_agent_llm_config(
            "pricing_agent",
            AgentLLMConfigUpdate(
                provider="openrouter",
                model="openrouter/auto",
                base_url="http://169.254.169.254/latest/meta-data",
                api_key_env="OPENROUTER_API_KEY",
                enabled=True,
            ),
        )

    assert exc.value.status_code == 400
