"""Pricing & finance endpoints — competitor scan + bulk apply + CollectAPI
finance widgets.

POST /api/v1/pricing/scan-competitors
    Trigger a competitor-price sweep across SKUs (CollectAPI shopping_search).

POST /api/v1/pricing/apply-all
    Queue every outstanding price-change suggestion as an approval batch.

GET  /api/v1/pricing/fx
    Live FX conversion via CollectAPI ``/economy/currencyToAll``.

GET  /api/v1/pricing/bist
    Live BIST snapshot via CollectAPI ``/economy/hisseSenedi``.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from apps.api.core.openclaw.executor import ExecutionContext, get_executor

router = APIRouter(prefix="/pricing", tags=["pricing"])


class ScanItem(BaseModel):
    sku: str
    query: str | None = None
    name: str | None = None


class ScanRequest(BaseModel):
    skus: list[str] = Field(default_factory=list)
    items: list[ScanItem] = Field(default_factory=list)
    source: str = "trendyol"
    limit: int = 12
    agent_id: str = "pricing_finance_agent"


@router.post("/scan-competitors", response_model=dict[str, Any])
async def scan_competitors(body: ScanRequest) -> dict[str, Any]:
    executor = get_executor()
    ctx = ExecutionContext(agent_id=body.agent_id, task_id=None, budget_usd=0.05)
    # Prefer rich items (with queries) over bare SKU codes — without a
    # human-readable query string CollectAPI search yields little.
    if body.items:
        item_payload = [
            {"sku": i.sku, "query": (i.query or i.name or i.sku)} for i in body.items
        ]
        payload: dict[str, Any] = {"items": item_payload}
    else:
        payload = {"skus": body.skus}
    payload["source"] = body.source
    payload["limit"] = body.limit
    try:
        result = await executor.execute(
            tool_id="competitor_price_scan",
            agent_id=body.agent_id,
            payload=payload,
            ctx=ctx,
        )
        return {"status": result.status, "output": result.output, "duration_ms": result.duration_ms}
    except Exception as exc:
        # Tool may not exist on this deployment — return a structured 200 with
        # degraded flag rather than 500 so the UI can fall back gracefully.
        return {"status": "degraded", "error": str(exc), "output": {"skus": body.skus}}


class ApplyAllRequest(BaseModel):
    sku_prices: list[dict[str, Any]] = Field(default_factory=list)
    agent_id: str = "pricing_finance_agent"


@router.post("/apply-all", response_model=dict[str, Any])
async def apply_all(body: ApplyAllRequest) -> dict[str, Any]:
    queued = 0
    failures: list[dict[str, Any]] = []
    executor = get_executor()
    ctx = ExecutionContext(agent_id=body.agent_id, task_id=None, budget_usd=0.05)
    for entry in body.sku_prices:
        sku = entry.get("sku")
        new_price = entry.get("new_price")
        if not sku or new_price is None:
            failures.append({"entry": entry, "reason": "missing sku or new_price"})
            continue
        try:
            await executor.execute(
                tool_id="dynamic_pricing_set",
                agent_id=body.agent_id,
                payload={"sku": sku, "new_price": new_price, "requires_approval": True},
                ctx=ctx,
            )
            queued += 1
        except Exception as exc:
            failures.append({"sku": sku, "reason": str(exc)})
    return {"queued": queued, "failures": failures}


@router.get("/fx", response_model=dict[str, Any])
async def fx_rates(
    base: str = Query("USD"),
    amount: float = Query(1.0, ge=0),
    targets: list[str] | None = Query(default=None),
) -> dict[str, Any]:
    """Live FX rates from CollectAPI ``/economy/currencyToAll``."""
    executor = get_executor()
    ctx = ExecutionContext(
        agent_id="pricing_finance_agent", task_id=None, budget_usd=0.01
    )
    payload: dict[str, Any] = {"amount": amount, "base": base.upper()}
    if targets:
        payload["targets"] = [t.upper() for t in targets]
    try:
        result = await executor.execute(
            tool_id="collectapi_currency_to_all",
            agent_id="pricing_finance_agent",
            payload=payload,
            ctx=ctx,
        )
        return {"status": result.status, "output": result.output, "duration_ms": result.duration_ms}
    except Exception as exc:
        return {"status": "degraded", "error": str(exc), "output": {"base": base, "amount": amount, "rates": []}}


@router.get("/bist", response_model=dict[str, Any])
async def bist_stocks(
    codes: list[str] | None = Query(default=None),
    limit: int = Query(20, ge=1, le=500),
) -> dict[str, Any]:
    """Live BIST snapshot from CollectAPI ``/economy/hisseSenedi``."""
    executor = get_executor()
    ctx = ExecutionContext(
        agent_id="pricing_finance_agent", task_id=None, budget_usd=0.01
    )
    payload: dict[str, Any] = {"limit": limit}
    if codes:
        payload["codes"] = [c.upper() for c in codes]
    try:
        result = await executor.execute(
            tool_id="collectapi_bist_stocks",
            agent_id="pricing_finance_agent",
            payload=payload,
            ctx=ctx,
        )
        return {"status": result.status, "output": result.output, "duration_ms": result.duration_ms}
    except Exception as exc:
        return {"status": "degraded", "error": str(exc), "output": {"count": 0, "stocks": []}}
