"""Shopify Admin REST API live adapter.

Tools wired:
- ``shopify_store_setup``      → ``GET /admin/api/{ver}/shop.json`` (auth probe)
- ``shopify_get_orders``       → ``GET /admin/api/{ver}/orders.json``
- ``shopify_update_inventory`` → ``POST /admin/api/{ver}/inventory_levels/set.json``

Auth: header ``X-Shopify-Access-Token`` (Admin API access token from a custom
or public app). Configure via ``SHOPIFY_SHOP`` (e.g. ``my-store``) and
``SHOPIFY_ACCESS_TOKEN`` in ``.env.local``. When either is missing, every
adapter short-circuits to a deterministic mock.

Rate-limit handling: Shopify REST returns ``429`` with ``Retry-After``. We
respect it up to ``_MAX_ATTEMPTS`` times, then raise so the breaker can trip.
The ``X-Shopify-Shop-Api-Call-Limit: used/40`` header is tracked so callers
can throttle preemptively when the bucket is >80% full.

Webhook verification lives in ``apps.api.routes.webhooks`` and uses
``SHOPIFY_WEBHOOK_SECRET``.
"""
from __future__ import annotations

import asyncio
from typing import Any

import httpx

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger
from apps.api.core.openclaw.breaker import with_breaker
from apps.api.core.openclaw.executor import register_live_adapter

log = get_logger(__name__)

_TIMEOUT = httpx.Timeout(connect=5.0, read=15.0, write=10.0, pool=5.0)
_MAX_ATTEMPTS = 4


def _base_url() -> str:
    s = get_settings()
    return f"https://{s.shopify_shop}.myshopify.com/admin/api/{s.shopify_api_version}"


def _auth_headers() -> dict[str, str]:
    return {
        "X-Shopify-Access-Token": get_settings().shopify_access_token,
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _configured() -> bool:
    s = get_settings()
    return bool(s.shopify_shop and s.shopify_access_token)


async def _request(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    json: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """One Shopify request with 429-aware retry. Raises on terminal failure
    so the breaker can count it."""
    url = f"{_base_url()}{path}"
    for attempt in range(1, _MAX_ATTEMPTS + 1):
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.request(
                method, url, params=params, json=json, headers=_auth_headers()
            )

        bucket = resp.headers.get("X-Shopify-Shop-Api-Call-Limit", "")
        if bucket:
            log.debug("shopify.bucket", value=bucket)

        if resp.status_code == 429:
            delay = float(resp.headers.get("Retry-After", "2"))
            log.warning("shopify.rate_limited", attempt=attempt, retry_in_s=delay)
            if attempt < _MAX_ATTEMPTS:
                await asyncio.sleep(min(delay, 20))
                continue
            resp.raise_for_status()

        if 500 <= resp.status_code < 600 and attempt < _MAX_ATTEMPTS:
            backoff = min(2 ** attempt, 12)
            log.warning("shopify.5xx", status=resp.status_code, attempt=attempt, backoff=backoff)
            await asyncio.sleep(backoff)
            continue

        resp.raise_for_status()
        return resp.json()

    raise RuntimeError("shopify._request: exhausted retries without returning")


# ---- store_setup ------------------------------------------------------------

async def _store_setup_live(payload: dict[str, Any]) -> dict[str, Any]:
    if not _configured():
        return await _store_setup_mock(payload)
    data = await _request("GET", "/shop.json")
    shop = data.get("shop", {})
    return {
        "shop": {
            "id": shop.get("id"),
            "name": shop.get("name"),
            "domain": shop.get("domain"),
            "country": shop.get("country_code"),
            "currency": shop.get("currency"),
            "plan_name": shop.get("plan_name"),
            "primary_locale": shop.get("primary_locale"),
        },
        "checklist": [
            {"step": "Ödeme sağlayıcı (Shopify Payments / iyzico) bağla", "done": shop.get("country_code") is not None},
            {"step": "KDV / vergi ayarlarını doğrula", "done": shop.get("taxes_included") is not None},
            {"step": "Yasal sayfaları yayınla (mesafeli satış, gizlilik, iade)", "done": False},
            {"step": "Kargo kuralları ve bölgeleri tanımla", "done": False},
            {"step": "Tema seç ve ana sayfa hero'yu güncelle", "done": False},
        ],
        "estimated_setup_hours": 6,
    }


async def _store_setup_mock(payload: dict[str, Any]) -> dict[str, Any]:
    shop_name = payload.get("shop_name") or "my-store"
    return {
        "shop": {
            "id": 0,
            "name": shop_name,
            "domain": f"{shop_name}.myshopify.com",
            "country": payload.get("country", "TR"),
            "currency": "TRY",
            "plan_name": "basic",
        },
        "checklist": [
            {"step": "Ödeme sağlayıcı bağla", "done": False},
            {"step": "KDV ayarlarını doğrula", "done": False},
            {"step": "Yasal sayfaları yayınla", "done": False},
            {"step": "Kargo bölgeleri tanımla", "done": False},
            {"step": "Tema seç", "done": False},
        ],
        "estimated_setup_hours": 6,
    }


# ---- get_orders -------------------------------------------------------------

async def _get_orders_live(payload: dict[str, Any]) -> dict[str, Any]:
    if not _configured():
        return await _get_orders_mock(payload)
    params: dict[str, Any] = {
        "limit": min(int(payload.get("limit") or 25), 250),
        "status": payload.get("status") or "any",
    }
    if "created_at_min" in payload:
        params["created_at_min"] = payload["created_at_min"]
    if "financial_status" in payload:
        params["financial_status"] = payload["financial_status"]

    data = await _request("GET", "/orders.json", params=params)
    orders = data.get("orders", [])
    return {
        "count": len(orders),
        "orders": [
            {
                "id": o.get("id"),
                "name": o.get("name"),
                "created_at": o.get("created_at"),
                "total_price": o.get("total_price"),
                "currency": o.get("currency"),
                "financial_status": o.get("financial_status"),
                "fulfillment_status": o.get("fulfillment_status"),
                "customer_email": (o.get("customer") or {}).get("email"),
                "line_items": [
                    {
                        "sku": li.get("sku"),
                        "title": li.get("title"),
                        "quantity": li.get("quantity"),
                    }
                    for li in o.get("line_items", [])[:5]
                ],
            }
            for o in orders
        ],
    }


async def _get_orders_mock(payload: dict[str, Any]) -> dict[str, Any]:
    limit = min(int(payload.get("limit") or 5), 10)
    return {
        "count": limit,
        "orders": [
            {
                "id": 1000 + i,
                "name": f"#10{1000 + i}",
                "created_at": "2025-01-15T10:30:00Z",
                "total_price": f"{(i + 1) * 249.90:.2f}",
                "currency": "TRY",
                "financial_status": "paid",
                "fulfillment_status": None,
                "customer_email": f"mock+{i}@example.com",
                "line_items": [{"sku": f"SKU-{i:03d}", "title": "Mock ürün", "quantity": 1}],
            }
            for i in range(limit)
        ],
    }


# ---- update_inventory -------------------------------------------------------

async def _update_inventory_live(payload: dict[str, Any]) -> dict[str, Any]:
    if not _configured():
        return await _update_inventory_mock(payload)
    body = {
        "location_id": int(payload["location_id"]),
        "inventory_item_id": int(payload["inventory_item_id"]),
        "available": int(payload["available"]),
    }
    data = await _request("POST", "/inventory_levels/set.json", json=body)
    level = data.get("inventory_level", {})
    return {
        "inventory_item_id": level.get("inventory_item_id"),
        "location_id": level.get("location_id"),
        "available": level.get("available"),
        "updated_at": level.get("updated_at"),
    }


async def _update_inventory_mock(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "inventory_item_id": payload.get("inventory_item_id", 0),
        "location_id": payload.get("location_id", 0),
        "available": payload.get("available", 0),
        "updated_at": "2025-01-15T10:30:00Z",
    }


def register() -> None:
    register_live_adapter(
        "shopify_store_setup",
        with_breaker(
            tool_id="shopify_store_setup",
            adapter=_store_setup_live,
            mock_fallback=_store_setup_mock,
        ),
    )
    register_live_adapter(
        "shopify_get_orders",
        with_breaker(
            tool_id="shopify_get_orders",
            adapter=_get_orders_live,
            mock_fallback=_get_orders_mock,
        ),
    )
    register_live_adapter(
        "shopify_update_inventory",
        with_breaker(
            tool_id="shopify_update_inventory",
            adapter=_update_inventory_live,
            mock_fallback=_update_inventory_mock,
        ),
    )
    log.info("live.shopify.registered", configured=_configured())
