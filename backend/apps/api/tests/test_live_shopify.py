"""Fake-server integration tests for the Shopify live adapter.

Uses ``httpx.MockTransport`` so we don't reach the real Shopify API. Each test
sets ``shopify_shop``/``shopify_access_token`` via env so the adapter takes
the live branch and patches ``httpx.AsyncClient`` to route through the mock
transport.

What's verified:
- happy path: response shape matches the documented `orders[].line_items` slice
- auth header carries ``X-Shopify-Access-Token``
- 429 with ``Retry-After`` triggers retry then succeeds
- 401 propagates as a terminal error so the breaker can count it
- 500 retries with backoff
"""
from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any

import httpx
import pytest

from apps.api.core.config import get_settings
from apps.api.tools.live import shopify as adapter


@pytest.fixture(autouse=True)
def _configure_shopify(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Set credentials so the adapter takes the live path. Cleared after."""
    # Cached settings object — clear so our env edits land.
    get_settings.cache_clear()  # type: ignore[attr-defined]
    monkeypatch.setenv("SHOPIFY_SHOP", "fake-store")
    monkeypatch.setenv("SHOPIFY_ACCESS_TOKEN", "shpat_fake_token_12345")
    monkeypatch.setenv("SHOPIFY_API_VERSION", "2024-10")
    yield
    get_settings.cache_clear()  # type: ignore[attr-defined]


def _patch_transport(monkeypatch: pytest.MonkeyPatch, handler) -> list[httpx.Request]:
    """Monkeypatch ``httpx.AsyncClient`` so any new client uses our mock
    transport. Returns a list that captures every request the adapter makes."""
    captured: list[httpx.Request] = []

    def _recording_handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return handler(request)

    orig = httpx.AsyncClient

    class _PatchedAsyncClient(orig):  # type: ignore[misc, valid-type]
        def __init__(self, *args, **kwargs):  # noqa: ANN001 — pass-through
            kwargs["transport"] = httpx.MockTransport(_recording_handler)
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", _PatchedAsyncClient)
    return captured


@pytest.mark.asyncio
async def test_get_orders_live_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/orders.json")
        assert request.headers["X-Shopify-Access-Token"] == "shpat_fake_token_12345"
        return httpx.Response(
            200,
            json={
                "orders": [
                    {
                        "id": 42,
                        "name": "#1042",
                        "created_at": "2025-01-15T10:30:00Z",
                        "total_price": "499.90",
                        "currency": "TRY",
                        "financial_status": "paid",
                        "fulfillment_status": "fulfilled",
                        "customer": {"email": "ada@example.com"},
                        "line_items": [
                            {"sku": "SKU-001", "title": "Granit tencere", "quantity": 2},
                        ],
                    }
                ]
            },
        )

    captured = _patch_transport(monkeypatch, handler)
    result = await adapter._get_orders_live({"limit": 5, "status": "any"})

    assert result["count"] == 1
    assert result["orders"][0]["id"] == 42
    assert result["orders"][0]["customer_email"] == "ada@example.com"
    assert result["orders"][0]["line_items"][0]["sku"] == "SKU-001"
    # Sanity: limit cap honoured (request issued with our param).
    assert captured[0].url.params.get("limit") == "5"


@pytest.mark.asyncio
async def test_get_orders_live_429_then_success(monkeypatch: pytest.MonkeyPatch) -> None:
    """Adapter must retry 429 (respecting Retry-After) and ultimately succeed."""
    # Speed up sleep so the test stays fast.
    async def _no_sleep(_sec: float) -> None:
        return None

    monkeypatch.setattr(adapter.asyncio, "sleep", _no_sleep)

    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(429, headers={"Retry-After": "1"}, json={})
        return httpx.Response(200, json={"orders": []})

    _patch_transport(monkeypatch, handler)
    result = await adapter._get_orders_live({"limit": 1})

    assert result["count"] == 0
    assert calls["n"] == 2  # exactly one retry after the 429


@pytest.mark.asyncio
async def test_get_orders_live_401_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    """401 is a terminal auth failure — must surface as HTTPStatusError so the
    breaker can count it. The executor wraps this back into a structured
    failure result; here we just verify it isn't swallowed."""
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"errors": "invalid token"})

    _patch_transport(monkeypatch, handler)
    with pytest.raises(httpx.HTTPStatusError):
        await adapter._get_orders_live({"limit": 1})


@pytest.mark.asyncio
async def test_get_orders_live_5xx_retries(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _no_sleep(_sec: float) -> None:
        return None

    monkeypatch.setattr(adapter.asyncio, "sleep", _no_sleep)

    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] < 3:
            return httpx.Response(503, json={"error": "service unavailable"})
        return httpx.Response(200, json={"orders": []})

    _patch_transport(monkeypatch, handler)
    result = await adapter._get_orders_live({"limit": 1})

    assert result["count"] == 0
    assert calls["n"] == 3  # two retries then success


@pytest.mark.asyncio
async def test_get_orders_falls_back_to_mock_when_not_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """When credentials are missing the live function delegates to the mock —
    no network call should be issued."""
    monkeypatch.delenv("SHOPIFY_SHOP", raising=False)
    monkeypatch.delenv("SHOPIFY_ACCESS_TOKEN", raising=False)
    get_settings.cache_clear()  # type: ignore[attr-defined]

    captured = _patch_transport(monkeypatch, lambda r: httpx.Response(500))
    result = await adapter._get_orders_live({"limit": 3})

    assert result["count"] == 3
    assert captured == []  # zero network calls


@pytest.mark.asyncio
async def test_update_inventory_live_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "POST"
        assert request.url.path.endswith("/inventory_levels/set.json")
        body = json.loads(request.content)
        assert body == {"location_id": 1, "inventory_item_id": 99, "available": 42}
        return httpx.Response(
            200,
            json={"inventory_level": {
                "inventory_item_id": 99, "location_id": 1, "available": 42,
            }},
        )

    _patch_transport(monkeypatch, handler)
    result = await adapter._update_inventory_live(
        {"location_id": 1, "inventory_item_id": 99, "available": 42}
    )
    assert result["available"] == 42
    assert result["location_id"] == 1
