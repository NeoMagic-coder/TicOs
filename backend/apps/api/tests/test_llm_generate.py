"""Tests for the server-side completion proxy ``POST /api/v1/llm/generate``.

The proxy replaces the browser's direct Gemini calls; without a
``GEMINI_API_KEY`` it must degrade to MockProvider instead of erroring, and
the ``json`` wire alias must keep matching the old frontend ``callGemini``
payload shape.
"""
from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from apps.api.core.config import get_settings
from apps.api.core.llm import provider as llm_provider_mod
from apps.api.main import create_app


def _fresh_app():
    get_settings.cache_clear()  # type: ignore[attr-defined]
    return create_app()


@pytest_asyncio.fixture
async def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("API_KEY", raising=False)
    # Inject MockProvider via the module singleton: dotenv files override env
    # vars in this project (settings_customise_sources), so env monkeypatching
    # can't win against a dev machine's .env.local provider choice.
    orig_provider = llm_provider_mod._provider
    llm_provider_mod._provider = llm_provider_mod.MockProvider()
    app = _fresh_app()
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c
    finally:
        llm_provider_mod._provider = orig_provider
        get_settings.cache_clear()  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_generate_returns_mock_completion(client: AsyncClient) -> None:
    res = await client.post(
        "/api/v1/llm/generate",
        json={"system": "Kısa yanıt ver", "user": "Merhaba de"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["text"]
    assert data["error"] is None
    assert data["provider"] == "mock"


@pytest.mark.asyncio
async def test_generate_accepts_legacy_callgemini_payload(client: AsyncClient) -> None:
    """Wire format parity: ``json`` alias + ``history`` turns must validate."""
    res = await client.post(
        "/api/v1/llm/generate",
        json={
            "system": "Yalnızca JSON üret",
            "history": [
                {"role": "user", "content": "selam"},
                {"role": "assistant", "content": "selam!"},
            ],
            "user": '{"istek": "marka adı"}',
            "json": True,
            "max_output_tokens": 8192,
        },
    )
    assert res.status_code == 200
    assert res.json()["text"]


@pytest.mark.asyncio
async def test_generate_rejects_out_of_range_params(client: AsyncClient) -> None:
    res = await client.post(
        "/api/v1/llm/generate",
        json={"user": "selam", "max_output_tokens": 0},
    )
    assert res.status_code == 422

    res = await client.post(
        "/api/v1/llm/generate",
        json={"user": "selam", "max_output_tokens": 999_999},
    )
    assert res.status_code == 422
