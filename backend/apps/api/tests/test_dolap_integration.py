"""Dolap integration registry and client tests."""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from apps.api.core.config import get_settings
from apps.api.tests.test_endpoint_hardening import _fresh_app


def _clear_dolap_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DOLAP_USERNAME", "")
    monkeypatch.setenv("DOLAP_PASSWORD", "")
    monkeypatch.setenv("DOLAP_ACCESS_TOKEN", "")
    monkeypatch.setenv("DOLAP_NICKNAME", "")
    monkeypatch.delenv("API_KEY", raising=False)
    monkeypatch.setattr("apps.api.routes.integrations.dolap_configured", lambda: False)
    monkeypatch.setattr("apps.api.routes.dolap.dolap_configured", lambda: False)
    monkeypatch.setattr("apps.api.core.dolap.client.dolap_configured", lambda: False)
    monkeypatch.setattr("apps.api.tools.live.dolap.dolap_configured", lambda: False)
    get_settings.cache_clear()


@pytest.mark.asyncio
async def test_integrations_dolap_disconnected_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_dolap_env(monkeypatch)

    app = _fresh_app(monkeypatch)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/v1/integrations")
    assert r.status_code == 200
    items = {i["id"]: i for i in r.json()}
    assert items["dolap"]["status"] == "disconnected"
    assert items["dolap"]["mode"] == "stub"


@pytest.mark.asyncio
async def test_integrations_dolap_connected_when_token_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DOLAP_ACCESS_TOKEN", "test-token-abc")
    monkeypatch.setenv("DOLAP_USERNAME", "magaza_nick")
    monkeypatch.setenv("DOLAP_NICKNAME", "magaza_nick")
    monkeypatch.setenv("DOLAP_PASSWORD", "")
    monkeypatch.delenv("API_KEY", raising=False)
    monkeypatch.setattr("apps.api.routes.integrations.dolap_configured", lambda: True)
    get_settings.cache_clear()

    app = _fresh_app(monkeypatch)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/v1/integrations")
    assert r.status_code == 200
    items = {i["id"]: i for i in r.json()}
    assert items["dolap"]["status"] == "connected"
    assert items["dolap"]["mode"] == "live"
    assert items["dolap"]["store_name"].startswith("@")


@pytest.mark.asyncio
async def test_dolap_status_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_dolap_env(monkeypatch)

    app = _fresh_app(monkeypatch)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/v1/dolap/status")
    assert r.status_code == 200
    body = r.json()
    assert body["configured"] is False
    assert body["connected"] is False


@pytest.mark.asyncio
async def test_dolap_get_products_mock_adapter(monkeypatch: pytest.MonkeyPatch) -> None:
    from apps.api.tools.live.dolap import _get_products_live

    _clear_dolap_env(monkeypatch)

    out = await _get_products_live({})
    assert out["degraded"] is True
    assert out["total"] >= 1
    assert out["products"][0]["id"] == "mock-dolap-1"
