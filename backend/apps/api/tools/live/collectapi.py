"""CollectAPI (https://collectapi.com) live adapter — shopping endpoints.

CollectAPI aggregates marketplace product data (Trendyol, Hepsiburada, n11,
Amazon TR, GittiGidiyor) behind a single REST surface. Useful for
market-research / competitor / pricing agents that need real Turkish
marketplace listings without standing up per-marketplace credentials.

Tools wired:
- ``collectapi_shopping_search``     → GET  /shopping/search
- ``collectapi_shopping_details``    → GET  /shopping/details
- ``collectapi_shopping_suggestion`` → POST /shoppingai/suggestion
- ``collectapi_price_follow``        → GET  /shopPrice/followPrice
- ``collectapi_currency_to_all``     → GET  /economy/currencyToAll
- ``collectapi_bist_stocks``         → GET  /economy/hisseSenedi

Auth: ``Authorization: apikey <COLLECTAPI_API_KEY>`` header. When the key is
empty the adapter degrades to a deterministic mock with ``degraded: true``.
"""
from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger
from apps.api.core.openclaw.breaker import with_breaker
from apps.api.core.openclaw.executor import register_live_adapter

log = get_logger(__name__)

_BASE_URL = "https://api.collectapi.com"
_TIMEOUT = httpx.Timeout(connect=5.0, read=20.0, write=10.0, pool=5.0)

# CollectAPI documents these sources for the shopping endpoint family.
_ALLOWED_SOURCES = {"trendyol", "hepsiburada", "n11", "amazon", "gittigidiyor"}


def _auth_headers() -> dict[str, str]:
    key = get_settings().collectapi_api_key
    if not key:
        raise RuntimeError("collectapi_api_key not configured")
    return {
        "content-type": "application/json",
        "authorization": f"apikey {key}",
    }


async def _get(path: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.get(f"{_BASE_URL}{path}", headers=_auth_headers())
        resp.raise_for_status()
        return resp.json() if resp.content else {}


async def _post(path: str, body: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(
            f"{_BASE_URL}{path}", headers=_auth_headers(), json=body
        )
        resp.raise_for_status()
        return resp.json() if resp.content else {}


# ── collectapi_shopping_search ───────────────────────────────────────────────


async def _search_live(payload: dict[str, Any]) -> dict[str, Any]:
    query = str(payload.get("query") or "").strip()
    if not query:
        raise ValueError("collectapi_shopping_search: 'query' is required")
    source = str(payload.get("source") or "trendyol").lower()
    if source not in _ALLOWED_SOURCES:
        raise ValueError(
            f"collectapi_shopping_search: 'source' must be one of {sorted(_ALLOWED_SOURCES)}"
        )

    path = f"/shopping/search?data.query={quote(query)}&data.source={source}"
    data = await _get(path)
    if not data.get("success", False):
        raise RuntimeError(f"collectapi error: {data.get('message') or data}")

    items = data.get("result") or []
    limit = payload.get("limit")
    if isinstance(limit, int) and limit > 0:
        items = items[:limit]
    return {"source": source, "query": query, "count": len(items), "results": items}


async def _search_mock(payload: dict[str, Any]) -> dict[str, Any]:
    query = str(payload.get("query") or "ürün")
    source = str(payload.get("source") or "trendyol").lower()
    limit = int(payload.get("limit") or 3)
    # Mirror upstream CollectAPI keys: image, name, desc, price, newprice, link.
    sample = [
        {
            "image": "https://i.pravatar.cc/300",
            "name": f"MOCK STORE {i + 1}",
            "desc": f"{query.title()} Mock Ürün #{i + 1}",
            "newprice": "",
            "price": f"{99 + i * 20},00 TL",
            "link": f"https://www.{source}.com/mock/{i + 1}",
        }
        for i in range(max(1, min(limit, 10)))
    ]
    return {
        "source": source,
        "query": query,
        "count": len(sample),
        "results": sample,
    }


# ── collectapi_shopping_details ──────────────────────────────────────────────


async def _details_live(payload: dict[str, Any]) -> dict[str, Any]:
    product_id = str(payload.get("id") or "").strip()
    if not product_id:
        raise ValueError("collectapi_shopping_details: 'id' is required")
    # The id parameter is itself usually a full product URL (Trendyol/etc.).
    path = f"/shopping/details?data.id={quote(product_id, safe='')}"
    data = await _get(path)
    if not data.get("success", False):
        raise RuntimeError(f"collectapi error: {data.get('message') or data}")
    return {"id": product_id, "detail": data.get("result") or {}}


async def _details_mock(payload: dict[str, Any]) -> dict[str, Any]:
    # Mirror upstream CollectAPI keys: type, price, newprice, seller, desc.
    return {
        "id": str(payload.get("id") or "mock-id"),
        "detail": {
            "type": "Mock Triko Kazak TOFAW00MK0000",
            "price": "199,00 tl",
            "newprice": "",
            "seller": "MOCK STORE",
            "desc": "Deterministic mock — collectapi unreachable or unauthorized.",
        },
    }


# ── collectapi_shopping_suggestion ───────────────────────────────────────────


async def _suggestion_live(payload: dict[str, Any]) -> dict[str, Any]:
    producturl = str(payload.get("producturl") or "").strip()
    if not producturl:
        raise ValueError("collectapi_shopping_suggestion: 'producturl' is required")
    data = await _post("/shoppingai/suggestion", {"producturl": producturl})
    if not data.get("success", False):
        raise RuntimeError(f"collectapi error: {data.get('message') or data}")
    items = data.get("result") or []
    limit = payload.get("limit")
    if isinstance(limit, int) and limit > 0:
        items = items[:limit]
    return {"producturl": producturl, "count": len(items), "suggestions": items}


async def _suggestion_mock(payload: dict[str, Any]) -> dict[str, Any]:
    producturl = str(payload.get("producturl") or "https://example.com/p/123")
    sample = [
        {
            "name": "Mock Aksesuar 1",
            "image": "https://i.pravatar.cc/300?img=11",
            "url": "https://example.com/aksesuar-1",
            "price": "199",
            "oldprice": "249",
        },
        {
            "name": "Mock Aksesuar 2",
            "image": "https://i.pravatar.cc/300?img=12",
            "url": "https://example.com/aksesuar-2",
            "price": "149",
            "oldprice": "",
        },
    ]
    return {"producturl": producturl, "count": len(sample), "suggestions": sample}


# ── collectapi_price_follow ──────────────────────────────────────────────────


async def _price_follow_live(payload: dict[str, Any]) -> dict[str, Any]:
    query = str(payload.get("query") or "").strip()
    if not query:
        raise ValueError("collectapi_price_follow: 'query' is required")

    sites = payload.get("sites") or payload.get("url")
    if isinstance(sites, list):
        url_param = ",".join(str(s).strip() for s in sites if str(s).strip())
    else:
        url_param = str(sites or "").strip()
    if not url_param:
        raise ValueError(
            "collectapi_price_follow: 'sites' (list) or 'url' (comma-separated) is required"
        )

    path = f"/shopPrice/followPrice?url={quote(url_param)}&query={quote(query)}"
    data = await _get(path)
    if not data.get("success", False):
        raise RuntimeError(f"collectapi error: {data.get('message') or data}")
    items = data.get("result") or []
    return {"query": query, "sites": url_param, "count": len(items), "results": items}


async def _price_follow_mock(payload: dict[str, Any]) -> dict[str, Any]:
    query = str(payload.get("query") or "ürün")
    sites = payload.get("sites") or payload.get("url") or "trendyol,hepsiburada"
    if isinstance(sites, list):
        sites = ",".join(sites)
    sample = [
        {"product": f"{query.title()} Mock {i}", "price": f"{7000 + i * 250} TL", "url": f"https://example.com/p/{i}"}
        for i in range(1, 4)
    ]
    return {"query": query, "sites": sites, "count": len(sample), "results": sample}


# ── collectapi_currency_to_all ───────────────────────────────────────────────


async def _currency_live(payload: dict[str, Any]) -> dict[str, Any]:
    amount = payload.get("amount")
    if amount is None:
        amount = payload.get("int")  # accept upstream param name too
    if amount is None:
        raise ValueError("collectapi_currency_to_all: 'amount' is required")
    try:
        amount_num = float(amount)
    except (TypeError, ValueError) as exc:
        raise ValueError("collectapi_currency_to_all: 'amount' must be numeric") from exc

    base = str(payload.get("base") or "USD").upper().strip()
    # Upstream wants the int param as integer-style; pass through as-is. The
    # API accepts decimals too; keep precision by sending the original string.
    amount_str = (
        str(int(amount_num)) if amount_num.is_integer() else f"{amount_num}"
    )
    path = f"/economy/currencyToAll?int={quote(amount_str)}&base={quote(base)}"
    data = await _get(path)
    if not data.get("success", False):
        raise RuntimeError(f"collectapi error: {data.get('message') or data}")

    result = data.get("result") or {}
    rates = result.get("data") or []
    targets = payload.get("targets")
    if isinstance(targets, list) and targets:
        wanted = {str(t).upper() for t in targets}
        rates = [r for r in rates if str(r.get("code", "")).upper() in wanted]

    return {
        "base": result.get("base") or base,
        "amount": amount_num,
        "lastupdate": result.get("lastupdate"),
        "count": len(rates),
        "rates": rates,
    }


async def _currency_mock(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        amount_num = float(payload.get("amount", payload.get("int", 100)))
    except (TypeError, ValueError):
        amount_num = 100.0
    base = str(payload.get("base") or "USD").upper()
    # Static-ish rates so downstream code still gets a believable shape.
    fx = {
        "USD": 1.0,
        "EUR": 0.92,
        "TRY": 32.50,
        "GBP": 0.79,
        "JPY": 156.0,
        "CHF": 0.88,
    }
    base_rate = fx.get(base, 1.0)
    rates = [
        {
            "code": code,
            "name": code,
            "rate": round(r / base_rate, 6),
            "calculated": round(amount_num * r / base_rate, 2),
            "calculatedstr": f"{amount_num * r / base_rate:.2f}",
        }
        for code, r in fx.items()
    ]
    targets = payload.get("targets")
    if isinstance(targets, list) and targets:
        wanted = {str(t).upper() for t in targets}
        rates = [r for r in rates if r["code"] in wanted]
    return {
        "base": base,
        "amount": amount_num,
        "lastupdate": "mock",
        "count": len(rates),
        "rates": rates,
    }


# ── collectapi_bist_stocks ───────────────────────────────────────────────────


async def _bist_live(payload: dict[str, Any]) -> dict[str, Any]:
    data = await _get("/economy/hisseSenedi")
    if not data.get("success", False):
        raise RuntimeError(f"collectapi error: {data.get('message') or data}")
    items = data.get("result") or []

    codes = payload.get("codes")
    if isinstance(codes, list) and codes:
        wanted = {str(c).upper().strip() for c in codes}
        items = [i for i in items if str(i.get("code", "")).upper() in wanted]

    limit = payload.get("limit")
    if isinstance(limit, int) and limit > 0:
        items = items[:limit]

    return {"count": len(items), "stocks": items}


async def _bist_mock(payload: dict[str, Any]) -> dict[str, Any]:
    sample = [
        {"code": "ACSEL", "text": "ACSEL - ACIPAYAM SELÜLOZ", "rate": 1.46, "lastprice": 6.25, "lastpricestr": "6,25", "hacim": 1181299.28, "hacimstr": "1.181.299,28"},
        {"code": "ADANA", "text": "ADANA - ADANA ÇİMENTO (A)", "rate": 2.45, "lastprice": 7.53, "lastpricestr": "7,53", "hacim": 2098390.07, "hacimstr": "2.098.390,07"},
        {"code": "THYAO", "text": "THYAO - TÜRK HAVA YOLLARI", "rate": -0.32, "lastprice": 285.50, "lastpricestr": "285,50", "hacim": 50000000.0, "hacimstr": "50.000.000,00"},
    ]
    codes = payload.get("codes")
    if isinstance(codes, list) and codes:
        wanted = {str(c).upper().strip() for c in codes}
        sample = [i for i in sample if i["code"] in wanted]
    return {"count": len(sample), "stocks": sample}


# ── registration ─────────────────────────────────────────────────────────────


def register() -> None:
    register_live_adapter(
        "collectapi_shopping_search",
        with_breaker(
            tool_id="collectapi_shopping_search",
            adapter=_search_live,
            mock_fallback=_search_mock,
        ),
    )
    register_live_adapter(
        "collectapi_shopping_details",
        with_breaker(
            tool_id="collectapi_shopping_details",
            adapter=_details_live,
            mock_fallback=_details_mock,
        ),
    )
    register_live_adapter(
        "collectapi_shopping_suggestion",
        with_breaker(
            tool_id="collectapi_shopping_suggestion",
            adapter=_suggestion_live,
            mock_fallback=_suggestion_mock,
        ),
    )
    register_live_adapter(
        "collectapi_price_follow",
        with_breaker(
            tool_id="collectapi_price_follow",
            adapter=_price_follow_live,
            mock_fallback=_price_follow_mock,
        ),
    )
    register_live_adapter(
        "collectapi_currency_to_all",
        with_breaker(
            tool_id="collectapi_currency_to_all",
            adapter=_currency_live,
            mock_fallback=_currency_mock,
        ),
    )
    register_live_adapter(
        "collectapi_bist_stocks",
        with_breaker(
            tool_id="collectapi_bist_stocks",
            adapter=_bist_live,
            mock_fallback=_bist_mock,
        ),
    )
    log.info("live.collectapi.registered", base_url=_BASE_URL)
