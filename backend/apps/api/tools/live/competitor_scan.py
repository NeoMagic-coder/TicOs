"""Competitor price scan — CollectAPI-backed live adapter.

For each requested SKU we hit CollectAPI ``/shopping/search`` (Trendyol by
default), parse Turkish-formatted prices ("199,90 TL"), and compute
``avg / min / max`` plus a ``samples`` count. The frontend treats
``samples > 0`` as the cue to switch the pricing band from "tahmini" to
"CANLI".

Input payload (executor schema is intentionally permissive — the route layer
shapes the request before this is called)::

    {
      "items": [{"sku": "TENC-01", "query": "granit tencere"}],
      "source": "trendyol",       # optional, default trendyol
      "limit": 12                  # optional, samples per SKU
    }

Backward-compatible: if only ``skus`` is provided we still attempt a scan,
using the SKU code itself as the query (low-yield but keeps callers working).

When ``COLLECTAPI_API_KEY`` is missing or the upstream returns 4xx/5xx, the
breaker trips and ``_scan_mock`` returns an empty (0-sample) envelope so the
UI keeps its heuristic band.
"""
from __future__ import annotations

import re
from datetime import UTC, datetime
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
_PRICE_RE = re.compile(r"([0-9][0-9\.\s]*[,\.]?[0-9]*)")


def _auth_headers() -> dict[str, str]:
    key = get_settings().collectapi_api_key
    if not key:
        raise RuntimeError("collectapi_api_key not configured")
    return {
        "content-type": "application/json",
        "authorization": f"apikey {key}",
    }


def _parse_price(raw: Any) -> float | None:
    """Parse Turkish-formatted price strings ("1.299,90 TL") to floats."""
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    text = str(raw).strip()
    if not text:
        return None
    match = _PRICE_RE.search(text)
    if not match:
        return None
    token = match.group(1).strip().replace(" ", "")
    # Turkish locale: . thousand-sep, , decimal-sep. Normalize to float.
    if "," in token:
        token = token.replace(".", "").replace(",", ".")
    else:
        # No comma: dots could be thousand separators ("1.299").
        # Only keep them as decimals when followed by 1-2 digits at end.
        parts = token.split(".")
        if len(parts) > 1 and len(parts[-1]) <= 2 and len(parts) == 2:
            token = parts[0] + "." + parts[1]
        else:
            token = "".join(parts)
    try:
        return float(token)
    except ValueError:
        return None


def _normalize_items(payload: dict[str, Any]) -> list[dict[str, str]]:
    """Accept ``items=[{sku, query}]`` (preferred) or ``skus=[...]``."""
    items_raw = payload.get("items")
    if isinstance(items_raw, list) and items_raw:
        out: list[dict[str, str]] = []
        for entry in items_raw:
            if isinstance(entry, dict):
                sku = str(entry.get("sku") or "").strip()
                query = str(entry.get("query") or entry.get("name") or sku).strip()
                if sku and query:
                    out.append({"sku": sku, "query": query})
        if out:
            return out
    skus = payload.get("skus") or []
    return [{"sku": str(s), "query": str(s)} for s in skus if str(s).strip()]


async def _search_one(
    client: httpx.AsyncClient, query: str, source: str, limit: int
) -> list[dict[str, Any]]:
    path = f"/shopping/search?data.query={quote(query)}&data.source={source}"
    resp = await client.get(f"{_BASE_URL}{path}", headers=_auth_headers())
    resp.raise_for_status()
    data = resp.json() if resp.content else {}
    if not data.get("success"):
        raise RuntimeError(f"collectapi error: {data.get('message') or data}")
    items = data.get("result") or []
    return items[:limit] if limit > 0 else items


async def _scan_live(payload: dict[str, Any]) -> dict[str, Any]:
    items = _normalize_items(payload)
    if not items:
        return {"measured_at": datetime.now(UTC).isoformat(), "results": [], "source": None}

    source = str(payload.get("source") or "trendyol").lower()
    limit = int(payload.get("limit") or 12)

    results: list[dict[str, Any]] = []
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        for item in items:
            sku = item["sku"]
            query = item["query"]
            try:
                listings = await _search_one(client, query, source, limit)
            except Exception as exc:
                log.warning(
                    "competitor_scan.collectapi.error",
                    sku=sku,
                    query=query,
                    error=str(exc),
                )
                # Surface as 0-sample for this SKU but keep going for others.
                results.append(
                    {
                        "sku": sku,
                        "query": query,
                        "source": source,
                        "avg": None,
                        "min": None,
                        "max": None,
                        "samples": 0,
                        "error": str(exc),
                    }
                )
                continue
            prices: list[float] = []
            for listing in listings:
                # Prefer the discounted ``newprice`` when present, otherwise
                # fall back to the list ``price`` field.
                cand = _parse_price(listing.get("newprice")) or _parse_price(
                    listing.get("price")
                )
                if cand is not None and cand > 0:
                    prices.append(cand)
            if prices:
                results.append(
                    {
                        "sku": sku,
                        "query": query,
                        "source": source,
                        "avg": round(sum(prices) / len(prices), 2),
                        "min": round(min(prices), 2),
                        "max": round(max(prices), 2),
                        "samples": len(prices),
                    }
                )
            else:
                results.append(
                    {
                        "sku": sku,
                        "query": query,
                        "source": source,
                        "avg": None,
                        "min": None,
                        "max": None,
                        "samples": 0,
                    }
                )
    return {
        "measured_at": datetime.now(UTC).isoformat(),
        "source": source,
        "results": results,
    }


async def _scan_mock(payload: dict[str, Any]) -> dict[str, Any]:
    """Breaker-open fallback — same shape, samples=0 so the UI stays in
    heuristic mode rather than claiming measured values."""
    items = _normalize_items(payload)
    return {
        "measured_at": None,
        "source": str(payload.get("source") or "trendyol").lower(),
        "results": [
            {
                "sku": it["sku"],
                "query": it["query"],
                "avg": None,
                "min": None,
                "max": None,
                "samples": 0,
            }
            for it in items
        ],
        "note": "mock fallback — collectapi unreachable or breaker open",
    }


def register() -> None:
    register_live_adapter(
        "competitor_price_scan",
        with_breaker(
            tool_id="competitor_price_scan",
            adapter=_scan_live,
            mock_fallback=_scan_mock,
        ),
    )
    log.info("live.competitor_price_scan.registered", backend="collectapi")
