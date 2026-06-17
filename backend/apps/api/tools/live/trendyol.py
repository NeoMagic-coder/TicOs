"""Trendyol Partner API live adapter.

Tools wired:
- ``trendyol_get_products``  → ``GET /sapigw/suppliers/{id}/products``
- ``trendyol_get_orders``    → ``GET /sapigw/suppliers/{id}/orders``
- ``trendyol_update_price``  → ``PUT /sapigw/suppliers/{id}/products/price-and-inventory``

Auth: Basic Auth — base64(API_KEY:API_SECRET). Configure via
``TRENDYOL_SUPPLIER_ID``, ``TRENDYOL_API_KEY``, ``TRENDYOL_API_SECRET``
in ``.env.local``. When any is missing the adapters fall back to mock.

Rate limits: Trendyol returns 429 with a Retry-After header. We respect it
up to ``_MAX_ATTEMPTS`` times, then raise so the circuit breaker can trip.
``trendyol_update_price`` is marked ``requires_approval: true`` in its
manifest and will create an ApprovalRow before executing.
"""
from __future__ import annotations

import asyncio
import base64
from typing import Any

import httpx

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger
from apps.api.core.openclaw.breaker import with_breaker
from apps.api.core.openclaw.executor import register_live_adapter

log = get_logger(__name__)

_BASE_URL = "https://api.trendyol.com"
_TIMEOUT = httpx.Timeout(connect=5.0, read=20.0, write=10.0, pool=5.0)
_MAX_ATTEMPTS = 3


def _configured() -> bool:
    s = get_settings()
    return bool(s.trendyol_supplier_id and s.trendyol_api_key and s.trendyol_api_secret)


def _auth_headers() -> dict[str, str]:
    s = get_settings()
    token = base64.b64encode(f"{s.trendyol_api_key}:{s.trendyol_api_secret}".encode()).decode()
    return {
        "Authorization": f"Basic {token}",
        "User-Agent": f"{s.trendyol_supplier_id} - SelfIntegration",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def _supplier_path(path: str) -> str:
    s = get_settings()
    return f"{_BASE_URL}/sapigw/suppliers/{s.trendyol_supplier_id}{path}"


async def _request(
    method: str,
    url: str,
    *,
    params: dict[str, Any] | None = None,
    json: dict[str, Any] | None = None,
) -> dict[str, Any]:
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.request(
                method, url, params=params, json=json, headers=_auth_headers()
            )

        if resp.status_code == 429:
            delay = float(resp.headers.get("Retry-After", "2"))
            log.warning("trendyol.rate_limited", attempt=attempt, retry_in_s=delay)
            if attempt < _MAX_ATTEMPTS:
                await asyncio.sleep(min(delay, 15))
                continue
            resp.raise_for_status()

        if 500 <= resp.status_code < 600 and attempt < _MAX_ATTEMPTS:
            backoff = min(2 ** attempt, 10)
            log.warning("trendyol.5xx", status=resp.status_code, backoff=backoff)
            await asyncio.sleep(backoff)
            continue

        resp.raise_for_status()
        return resp.json() if resp.content else {}

    raise RuntimeError("trendyol._request: exhausted retries")


# ── trendyol_get_products ─────────────────────────────────────────────────────

async def _get_products_live(payload: dict[str, Any]) -> dict[str, Any]:
    if not _configured():
        raise RuntimeError("trendyol_not_configured: set TRENDYOL_* env vars")
    params: dict[str, Any] = {
        "page": payload.get("page", 0),
        "size": min(int(payload.get("size", 10)), 50),
    }
    if "barcode" in payload:
        params["barcode"] = payload["barcode"]
    data = await _request("GET", _supplier_path("/products"), params=params)
    items = data.get("content", [])
    return {
        "total_elements": data.get("totalElements", len(items)),
        "page": data.get("number", 0),
        "size": data.get("size", len(items)),
        "products": [
            {
                "barcode": p.get("barcode"),
                "title": p.get("title"),
                "product_main_id": p.get("productMainId"),
                "brand_name": p.get("brandName"),
                "category_name": p.get("categoryName"),
                "list_price": p.get("listPrice"),
                "sale_price": p.get("salePrice"),
                "quantity": p.get("quantity"),
                "approved": p.get("approved"),
                "rejected": p.get("rejected"),
                "on_sale": p.get("onSale"),
            }
            for p in items
        ],
    }


async def _get_products_mock(payload: dict[str, Any]) -> dict[str, Any]:
    size = min(int(payload.get("size", 3)), 5)
    return {
        "total_elements": size,
        "page": 0,
        "size": size,
        "products": [
            {
                "barcode": f"TY-MOCK-{i:04d}",
                "title": f"Demo Ürün {i + 1}",
                "product_main_id": f"MAIN-{i}",
                "brand_name": "DemoBrand",
                "category_name": "Genel",
                "list_price": 299.0 + i * 50,
                "sale_price": 249.0 + i * 50,
                "quantity": 100 - i * 10,
                "approved": True,
                "rejected": False,
                "on_sale": True,
            }
            for i in range(size)
        ],
    }


# ── trendyol_get_orders ───────────────────────────────────────────────────────

async def _get_orders_live(payload: dict[str, Any]) -> dict[str, Any]:
    if not _configured():
        raise RuntimeError("trendyol_not_configured: set TRENDYOL_* env vars")
    params: dict[str, Any] = {
        "page": payload.get("page", 0),
        "size": min(int(payload.get("size", 10)), 50),
        "status": payload.get("status", "Created"),
    }
    data = await _request("GET", _supplier_path("/orders"), params=params)
    orders = data.get("content", [])
    return {
        "total_elements": data.get("totalElements", len(orders)),
        "page": data.get("number", 0),
        "orders": [
            {
                "order_number": o.get("orderNumber"),
                "status": o.get("status"),
                "order_date": o.get("orderDate"),
                "gross_amount": o.get("grossAmount"),
                "total_discount": o.get("totalDiscount"),
                "customer_first_name": o.get("customerFirstName"),
                "cargo_tracking_number": o.get("cargoTrackingNumber"),
                "lines": [
                    {
                        "barcode": ln.get("barcode"),
                        "quantity": ln.get("quantity"),
                        "amount": ln.get("amount"),
                    }
                    for ln in o.get("lines", [])[:5]
                ],
            }
            for o in orders
        ],
    }


async def _get_orders_mock(payload: dict[str, Any]) -> dict[str, Any]:
    size = min(int(payload.get("size", 3)), 5)
    return {
        "total_elements": size,
        "page": 0,
        "orders": [
            {
                "order_number": f"TY-ORD-{1000 + i}",
                "status": "Created",
                "order_date": "2026-05-16T10:00:00Z",
                "gross_amount": 299.0 + i * 50,
                "total_discount": 0.0,
                "customer_first_name": f"Demo Müşteri {i + 1}",
                "cargo_tracking_number": None,
                "lines": [{"barcode": f"TY-MOCK-{i:04d}", "quantity": 1, "amount": 299.0 + i * 50}],
            }
            for i in range(size)
        ],
    }


# ── trendyol_update_price ─────────────────────────────────────────────────────

async def _update_price_live(payload: dict[str, Any]) -> dict[str, Any]:
    if not _configured():
        raise RuntimeError("trendyol_not_configured: set TRENDYOL_* env vars")
    items = payload.get("items")
    if not items:
        barcode = payload.get("barcode")
        sale_price = float(payload.get("sale_price", 0))
        list_price = float(payload.get("list_price", sale_price))
        quantity = payload.get("quantity")
        item: dict[str, Any] = {"barcode": barcode, "salePrice": sale_price, "listPrice": list_price}
        if quantity is not None:
            item["quantity"] = int(quantity)
        items = [item]

    body = {"items": items}
    await _request("PUT", _supplier_path("/products/price-and-inventory"), json=body)
    return {
        "updated": len(items),
        "barcodes": [it.get("barcode") for it in items],
        "ok": True,
    }


async def _update_price_mock(payload: dict[str, Any]) -> dict[str, Any]:
    items = payload.get("items", [{"barcode": payload.get("barcode", "MOCK-001")}])
    return {
        "updated": len(items),
        "barcodes": [it.get("barcode") for it in items],
        "ok": True,
    }


# ── trendyol_create_listing ───────────────────────────────────────────────────

async def _create_listing_live(payload: dict[str, Any]) -> dict[str, Any]:
    if not _configured():
        raise RuntimeError("trendyol_not_configured: set TRENDYOL_* env vars")
    sale_price = float(payload["sale_price"])
    list_price = float(payload.get("list_price") or sale_price)
    item: dict[str, Any] = {
        "title": payload["title"],
        "description": payload.get("description", ""),
        "barcode": payload["barcode"],
        "salePrice": sale_price,
        "listPrice": list_price,
        "quantity": int(payload.get("quantity", 0)),
    }
    for key in ("brand", "stockCode", "categoryId", "productMainId", "vatRate", "currencyType"):
        if payload.get(key) is not None:
            item[key] = payload[key]
    body = {"items": [item]}
    data = await _request("POST", _supplier_path("/v2/products"), json=body)
    batch_id = (data or {}).get("batchRequestId") or (data or {}).get("batch_id")
    return {
        "product_main_id": payload.get("productMainId") or payload["barcode"],
        "barcode": payload["barcode"],
        "batch_request_id": batch_id,
        "status": "submitted",
        "ok": True,
    }


async def _create_listing_mock(payload: dict[str, Any]) -> dict[str, Any]:
    barcode = payload.get("barcode") or "TY-MOCK-0001"
    return {
        "product_main_id": payload.get("productMainId") or barcode,
        "barcode": barcode,
        "batch_request_id": f"mock-{barcode}",
        "status": "submitted",
        "ok": True,
        "degraded": True,
    }


# ── registration ──────────────────────────────────────────────────────────────

def register() -> None:
    register_live_adapter(
        "trendyol_get_products",
        with_breaker(
            tool_id="trendyol_get_products",
            adapter=_get_products_live,
            mock_fallback=_get_products_mock,
        ),
    )
    register_live_adapter(
        "trendyol_get_orders",
        with_breaker(
            tool_id="trendyol_get_orders",
            adapter=_get_orders_live,
            mock_fallback=_get_orders_mock,
        ),
    )
    register_live_adapter(
        "trendyol_update_price",
        with_breaker(
            tool_id="trendyol_update_price",
            adapter=_update_price_live,
            mock_fallback=_update_price_mock,
        ),
    )
    register_live_adapter(
        "trendyol_create_listing",
        with_breaker(
            tool_id="trendyol_create_listing",
            adapter=_create_listing_live,
            mock_fallback=_create_listing_mock,
        ),
    )
    log.info("live.trendyol.registered", configured=_configured())
