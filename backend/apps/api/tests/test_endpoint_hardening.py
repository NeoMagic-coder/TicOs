"""Endpoint-level integration tests for the Wave 5/6 hardening features:

- W5.4 per-product daily budget enforcement → 429
- W5.6 optional X-API-Key middleware → 401 without header, 200 with
- W4.2 /api/v1/integrations env-driven status flip

The app is constructed via ``create_app()`` in each test so settings changes
(env, monkeypatch) actually land — the FastAPI app caches middleware at
construction time."""
from __future__ import annotations

from collections.abc import Iterator

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from apps.api.core.config import get_settings
from apps.api.main import create_app


def _fresh_app(monkeypatch: pytest.MonkeyPatch | None = None):
    # Clear the cached settings so env mutations applied right before this
    # call are visible in create_app.
    get_settings.cache_clear()  # type: ignore[attr-defined]
    return create_app()


# ----------------------------------------------------------------------------
# W5.4 — Daily budget enforcement
# ----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_chat_returns_429_when_budget_exhausted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When DAILY_BUDGET_MAX_USD is set and a product has already spent the
    cap, /api/v1/chat refuses new tasks before invoking the orchestrator."""
    monkeypatch.setenv("DAILY_BUDGET_MAX_USD", "0.01")
    monkeypatch.delenv("API_KEY", raising=False)

    # Pre-record spend so the pre-flight check fires.
    from apps.api.core import budget

    budget._spend.clear()
    budget.record("Test Ürün", 1.00)  # > cap

    app = _fresh_app(monkeypatch)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/chat",
            json={
                "message": "test",
                "history": [],
                "product_context": {"product_name": "Test Ürün"},
            },
        )

    assert resp.status_code == 429
    body = resp.json()
    assert body["detail"]["error"] == "daily_budget_exhausted"
    assert body["detail"]["product"] == "Test Ürün"
    assert resp.headers.get("Retry-After") == "3600"


@pytest.mark.asyncio
async def test_chat_passes_when_budget_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    """Budget=0 (default) means no enforcement — request should NOT be
    short-circuited even with huge recorded spend."""
    monkeypatch.delenv("DAILY_BUDGET_MAX_USD", raising=False)
    monkeypatch.delenv("API_KEY", raising=False)

    from apps.api.core import budget

    budget._spend.clear()
    budget.record("Test Ürün", 9999.99)  # spend doesn't matter when cap is 0

    app = _fresh_app(monkeypatch)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/chat",
            json={
                "message": "ping",
                "history": [],
                "product_context": {"product_name": "Test Ürün"},
            },
        )

    # Real orchestrator runs; the 429 short-circuit must NOT fire.
    assert resp.status_code != 429
    assert resp.status_code == 200


# ----------------------------------------------------------------------------
# W5.6 — Optional X-API-Key middleware
# ----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_api_key_required_when_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("API_KEY", "secret-key-xyz")
    app = _fresh_app(monkeypatch)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Missing header → 401
        r1 = await client.get("/api/v1/agents")
        assert r1.status_code == 401

        # Wrong header → 401
        r2 = await client.get("/api/v1/agents", headers={"X-API-Key": "wrong"})
        assert r2.status_code == 401

        # Correct header → 200
        r3 = await client.get("/api/v1/agents", headers={"X-API-Key": "secret-key-xyz"})
        assert r3.status_code == 200


@pytest.mark.asyncio
async def test_health_always_exempt(monkeypatch: pytest.MonkeyPatch) -> None:
    """/health must be reachable without an API key even when the gate is on
    (used by container healthchecks)."""
    monkeypatch.setenv("API_KEY", "secret-key-xyz")
    app = _fresh_app(monkeypatch)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/health")
        assert r.status_code == 200


@pytest.mark.asyncio
async def test_api_key_disabled_when_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    """Empty API_KEY means no middleware — requests succeed without any
    X-API-Key header (dev mode default)."""
    monkeypatch.delenv("API_KEY", raising=False)
    app = _fresh_app(monkeypatch)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/v1/agents")
        assert r.status_code == 200


# ----------------------------------------------------------------------------
# W4.2 — /api/v1/integrations status reflects env config
# ----------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_integrations_disconnected_by_default(monkeypatch: pytest.MonkeyPatch) -> None:
    for v in ("SHOPIFY_SHOP", "SHOPIFY_ACCESS_TOKEN", "TRENDYOL_SUPPLIER_ID",
              "TRENDYOL_API_KEY", "GA4_PROPERTY_ID", "API_KEY"):
        monkeypatch.delenv(v, raising=False)

    app = _fresh_app(monkeypatch)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/v1/integrations")
    assert r.status_code == 200
    items = {i["id"]: i for i in r.json()}
    assert items["shopify"]["status"] == "disconnected"
    assert items["trendyol"]["status"] == "disconnected"
    assert items["ga4"]["status"] == "disconnected"
    assert items["meta_ads"]["mode"] == "stub"


@pytest.mark.asyncio
async def test_integrations_connected_when_shopify_env_set(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("SHOPIFY_SHOP", "my-store")
    monkeypatch.setenv("SHOPIFY_ACCESS_TOKEN", "shpat_xxx")
    monkeypatch.delenv("API_KEY", raising=False)

    app = _fresh_app(monkeypatch)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        r = await client.get("/api/v1/integrations")
    assert r.status_code == 200
    items = {i["id"]: i for i in r.json()}
    assert items["shopify"]["status"] == "connected"
    assert items["shopify"]["mode"] == "live"
    assert items["shopify"]["last_sync"] is not None
    # Others stay disconnected
    assert items["trendyol"]["status"] == "disconnected"
