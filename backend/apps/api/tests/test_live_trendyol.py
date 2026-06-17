"""Fake-server integration tests for the Trendyol Partner API adapter.

Verifies:
- Basic Auth header is built from API_KEY:API_SECRET (base64)
- supplier_id is interpolated into the URL path
- happy path mapping for get_products
- 429 retry honouring Retry-After
- missing credentials raise RuntimeError (no silent mock fallthrough — the
  Trendyol adapter's contract is "configured or fail")
"""
from __future__ import annotations

import base64
from collections.abc import Iterator

import httpx
import pytest

from apps.api.core.config import get_settings
from apps.api.tools.live import trendyol as adapter


@pytest.fixture(autouse=True)
def _configure_trendyol(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    get_settings.cache_clear()  # type: ignore[attr-defined]
    monkeypatch.setenv("TRENDYOL_SUPPLIER_ID", "999777")
    monkeypatch.setenv("TRENDYOL_API_KEY", "ty_key_fake")
    monkeypatch.setenv("TRENDYOL_API_SECRET", "ty_secret_fake")
    yield
    get_settings.cache_clear()  # type: ignore[attr-defined]


def _patch_transport(monkeypatch: pytest.MonkeyPatch, handler) -> list[httpx.Request]:
    captured: list[httpx.Request] = []

    def _recording(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return handler(request)

    orig = httpx.AsyncClient

    class _PatchedAsyncClient(orig):  # type: ignore[misc, valid-type]
        def __init__(self, *args, **kwargs):  # noqa: ANN001
            kwargs["transport"] = httpx.MockTransport(_recording)
            super().__init__(*args, **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", _PatchedAsyncClient)
    return captured


@pytest.mark.asyncio
async def test_get_products_live_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        # URL contains supplier_id
        assert "/suppliers/999777/products" in request.url.path
        # Basic Auth header is base64(API_KEY:API_SECRET)
        expected = base64.b64encode(b"ty_key_fake:ty_secret_fake").decode()
        assert request.headers["Authorization"] == f"Basic {expected}"
        # UA carries supplier id (Trendyol contract)
        assert "999777" in request.headers["User-Agent"]
        return httpx.Response(
            200,
            json={
                "totalElements": 1,
                "number": 0,
                "size": 1,
                "content": [
                    {
                        "barcode": "TY-001",
                        "title": "Granit tencere",
                        "productMainId": "MAIN-1",
                        "brandName": "Demo",
                        "categoryName": "Ev",
                        "listPrice": 399.0,
                        "salePrice": 349.0,
                        "quantity": 12,
                        "approved": True,
                        "rejected": False,
                        "onSale": True,
                    }
                ],
            },
        )

    _patch_transport(monkeypatch, handler)
    result = await adapter._get_products_live({"size": 1})

    assert result["total_elements"] == 1
    assert result["products"][0]["barcode"] == "TY-001"
    assert result["products"][0]["list_price"] == 399.0


@pytest.mark.asyncio
async def test_get_products_live_429_then_success(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _no_sleep(_sec: float) -> None:
        return None

    monkeypatch.setattr(adapter.asyncio, "sleep", _no_sleep)

    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] == 1:
            return httpx.Response(429, headers={"Retry-After": "1"}, json={})
        return httpx.Response(200, json={"content": []})

    _patch_transport(monkeypatch, handler)
    result = await adapter._get_products_live({"size": 1})

    assert result["products"] == []
    assert calls["n"] == 2


@pytest.mark.asyncio
async def test_unconfigured_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    """Trendyol live adapter has no mock fallback — when env is missing it
    must raise so the breaker can route the executor to the manifest's
    mock fallback tool. Verified explicitly here so a future "silent
    swallow" regression is caught."""
    monkeypatch.delenv("TRENDYOL_SUPPLIER_ID", raising=False)
    monkeypatch.delenv("TRENDYOL_API_KEY", raising=False)
    monkeypatch.delenv("TRENDYOL_API_SECRET", raising=False)
    get_settings.cache_clear()  # type: ignore[attr-defined]

    captured = _patch_transport(monkeypatch, lambda r: httpx.Response(500))
    with pytest.raises(RuntimeError, match="trendyol_not_configured"):
        await adapter._get_products_live({"size": 1})
    assert captured == []  # no HTTP call attempted
