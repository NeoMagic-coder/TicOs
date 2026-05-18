"""FakeStoreAPI (https://fakestoreapi.com) live adapter.

Free, hosted REST API with pseudo-real e-commerce data — products, categories,
carts, users. Useful as a deterministic, public data source for testing
catalog/research/pricing agents without standing up a real Shopify or
Trendyol store.

Tools wired:
- ``fakestore_list_products``      → ``GET /products``
- ``fakestore_get_product``        → ``GET /products/{id}``
- ``fakestore_list_categories``    → ``GET /products/categories``
- ``fakestore_list_carts``         → ``GET /carts``
- ``fakestore_list_users``         → ``GET /users``

No auth required. Wrapped with the standard circuit breaker so a hosted
outage degrades to a small deterministic mock with ``degraded: true``.
"""
from __future__ import annotations

from typing import Any

import httpx

from apps.api.core.logging import get_logger
from apps.api.core.openclaw.breaker import with_breaker
from apps.api.core.openclaw.executor import register_live_adapter

log = get_logger(__name__)

_BASE_URL = "https://fakestoreapi.com"
_TIMEOUT = httpx.Timeout(connect=5.0, read=15.0, write=10.0, pool=5.0)


async def _get(path: str, *, params: dict[str, Any] | None = None) -> Any:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(f"{_BASE_URL}{path}", params=params)
        resp.raise_for_status()
        return resp.json() if resp.content else None


# ── fakestore_list_products ──────────────────────────────────────────────────


async def _list_products_live(payload: dict[str, Any]) -> dict[str, Any]:
    category = payload.get("category")
    path = f"/products/category/{category}" if category else "/products"

    params: dict[str, Any] = {}
    if "limit" in payload:
        params["limit"] = max(1, min(int(payload["limit"]), 50))
    if payload.get("sort") in ("asc", "desc"):
        params["sort"] = payload["sort"]

    data = await _get(path, params=params or None)
    items = data if isinstance(data, list) else []
    return {"count": len(items), "products": items}


async def _list_products_mock(payload: dict[str, Any]) -> dict[str, Any]:
    limit = max(1, min(int(payload.get("limit", 3)), 50))
    sample = [
        {
            "id": i + 1,
            "title": f"Mock Product {i + 1}",
            "price": 19.99 + i * 5,
            "category": payload.get("category") or "electronics",
            "description": "Deterministic mock — fakestoreapi unreachable.",
            "image": "https://i.pravatar.cc/300",
            "rating": {"rate": 4.0, "count": 100 + i * 10},
        }
        for i in range(limit)
    ]
    return {"count": len(sample), "products": sample}


# ── fakestore_get_product ────────────────────────────────────────────────────


async def _get_product_live(payload: dict[str, Any]) -> dict[str, Any]:
    product_id = int(payload.get("id", 1))
    data = await _get(f"/products/{product_id}")
    if not isinstance(data, dict):
        raise RuntimeError(f"fakestore_get_product: unexpected payload for id={product_id}")
    return data


async def _get_product_mock(payload: dict[str, Any]) -> dict[str, Any]:
    pid = int(payload.get("id", 1))
    return {
        "id": pid,
        "title": f"Mock Product {pid}",
        "price": 19.99,
        "category": "electronics",
        "description": "Deterministic mock — fakestoreapi unreachable.",
        "image": "https://i.pravatar.cc/300",
        "rating": {"rate": 4.0, "count": 100},
    }


# ── fakestore_list_categories ────────────────────────────────────────────────


async def _list_categories_live(_payload: dict[str, Any]) -> dict[str, Any]:
    data = await _get("/products/categories")
    items = data if isinstance(data, list) else []
    return {"count": len(items), "categories": items}


async def _list_categories_mock(_payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "count": 4,
        "categories": ["electronics", "jewelery", "men's clothing", "women's clothing"],
    }


# ── fakestore_list_carts ─────────────────────────────────────────────────────


async def _list_carts_live(payload: dict[str, Any]) -> dict[str, Any]:
    params: dict[str, Any] = {}
    if "limit" in payload:
        params["limit"] = max(1, min(int(payload["limit"]), 50))
    if payload.get("sort") in ("asc", "desc"):
        params["sort"] = payload["sort"]
    data = await _get("/carts", params=params or None)
    items = data if isinstance(data, list) else []
    return {"count": len(items), "carts": items}


async def _list_carts_mock(payload: dict[str, Any]) -> dict[str, Any]:
    limit = max(1, min(int(payload.get("limit", 3)), 50))
    sample = [
        {
            "id": i + 1,
            "userId": (i % 5) + 1,
            "date": "2024-01-01T00:00:00.000Z",
            "products": [{"productId": 1, "quantity": i + 1}],
        }
        for i in range(limit)
    ]
    return {"count": len(sample), "carts": sample}


# ── fakestore_list_users ─────────────────────────────────────────────────────


async def _list_users_live(payload: dict[str, Any]) -> dict[str, Any]:
    params: dict[str, Any] = {}
    if "limit" in payload:
        params["limit"] = max(1, min(int(payload["limit"]), 20))
    data = await _get("/users", params=params or None)
    items = data if isinstance(data, list) else []
    # Drop password hashes before returning to agents.
    safe = [{k: v for k, v in u.items() if k != "password"} for u in items if isinstance(u, dict)]
    return {"count": len(safe), "users": safe}


async def _list_users_mock(payload: dict[str, Any]) -> dict[str, Any]:
    limit = max(1, min(int(payload.get("limit", 2)), 20))
    sample = [
        {
            "id": i + 1,
            "email": f"user{i + 1}@example.com",
            "username": f"user{i + 1}",
            "name": {"firstname": "Mock", "lastname": f"User{i + 1}"},
            "phone": "1-555-0100",
        }
        for i in range(limit)
    ]
    return {"count": len(sample), "users": sample}


# ── registration ─────────────────────────────────────────────────────────────


def register() -> None:
    register_live_adapter(
        "fakestore_list_products",
        with_breaker(
            tool_id="fakestore_list_products",
            adapter=_list_products_live,
            mock_fallback=_list_products_mock,
        ),
    )
    register_live_adapter(
        "fakestore_get_product",
        with_breaker(
            tool_id="fakestore_get_product",
            adapter=_get_product_live,
            mock_fallback=_get_product_mock,
        ),
    )
    register_live_adapter(
        "fakestore_list_categories",
        with_breaker(
            tool_id="fakestore_list_categories",
            adapter=_list_categories_live,
            mock_fallback=_list_categories_mock,
        ),
    )
    register_live_adapter(
        "fakestore_list_carts",
        with_breaker(
            tool_id="fakestore_list_carts",
            adapter=_list_carts_live,
            mock_fallback=_list_carts_mock,
        ),
    )
    register_live_adapter(
        "fakestore_list_users",
        with_breaker(
            tool_id="fakestore_list_users",
            adapter=_list_users_live,
            mock_fallback=_list_users_mock,
        ),
    )
    log.info("live.fakestore.registered", base_url=_BASE_URL)
