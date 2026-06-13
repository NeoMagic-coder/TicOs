"""Dashboard summary + per-product snapshot endpoints.

- ``GET /api/v1/dashboard``                       legacy summary (tasks/approvals counts)
- ``GET /api/v1/dashboard/snapshot``               most-recent rollup for the active product
- ``GET /api/v1/dashboard/snapshot?product=X``     rollup for a named product
- ``POST /api/v1/dashboard/snapshot``              upsert today's rollup (frontend pushes
  the demo fixtures here so reload reflects them)

The Phase-3 plan replaces the POST with a real daily rollup job that
aggregates orders → snapshot rows. For now any client (UI demo button or
agent run) can write a snapshot and we trust the `source` flag.
"""
from __future__ import annotations

from datetime import UTC, date, datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select

from apps.api.core.db import session_scope
from apps.api.core.db.models import DashboardSnapshotRow, ProductRow
from apps.api.services.dashboard_rollup import upsert_dashboard_rollup
from apps.api.services.task_store import get_approval_store, get_task_store

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=dict[str, Any])
async def dashboard_summary(product_id: str | None = None) -> dict[str, Any]:
    tasks = get_task_store().all()
    approvals = get_approval_store().all()

    active_tasks = sum(1 for t in tasks if getattr(t, "status", "") in {"queued", "running"})
    pending_approvals = sum(1 for a in approvals if getattr(a, "status", "") == "pending")

    return {
        "product_id": product_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "active_tasks": active_tasks,
        "pending_approvals": pending_approvals,
        "totals": {
            "tasks": len(tasks),
            "approvals": len(approvals),
        },
    }


class SnapshotIn(BaseModel):
    product: str | None = None  # falls back to the currently-active product
    today_sales: float = 0.0
    today_orders: int = 0
    today_roas: float = 0.0
    conversion_rate: float = 0.0
    avg_order_value: float = 0.0
    sales_trend: list[dict[str, Any]] = Field(default_factory=list)
    orders_trend: list[int] = Field(default_factory=list)
    roas_trend: list[float] = Field(default_factory=list)
    channel_performance: list[dict[str, Any]] = Field(default_factory=list)
    source: str = "derived"


def _resolve_product(session: Any, hint: str | None) -> str | None:
    if hint:
        return hint
    row = session.execute(select(ProductRow.name).where(ProductRow.is_active.is_(True))).first()
    return row[0] if row else None


def _row_to_dict(row: DashboardSnapshotRow) -> dict[str, Any]:
    return {
        "product": row.product_name,
        "date": row.date,
        "today_sales": row.today_sales,
        "today_orders": row.today_orders,
        "today_roas": row.today_roas,
        "conversion_rate": row.conversion_rate,
        "avg_order_value": row.avg_order_value,
        "sales_trend": list(row.sales_trend or []),
        "orders_trend": list(row.orders_trend or []),
        "roas_trend": list(row.roas_trend or []),
        "channel_performance": list(row.channel_performance or []),
        "source": row.source,
        "measured_at": row.measured_at.isoformat() if row.measured_at else None,
    }


@router.get("/snapshot")
async def get_snapshot(product: str | None = None, live: bool = False) -> dict[str, Any]:
    """Return the most recent dashboard snapshot for the given (or active) product.

    When ``live=1``, recompute from tic_orders before returning (overwrites today's row).
    """
    with session_scope() as s:
        name = _resolve_product(s, product)
        if not name:
            raise HTTPException(status_code=404, detail="no active product")
        if live:
            snap = upsert_dashboard_rollup(name)
            return {"product": name, "snapshot": snap}
        row = s.execute(
            select(DashboardSnapshotRow)
            .where(DashboardSnapshotRow.product_name == name)
            .order_by(DashboardSnapshotRow.measured_at.desc())
            .limit(1),
        ).scalar_one_or_none()
        if row is None:
            snap = upsert_dashboard_rollup(name)
            return {"product": name, "snapshot": snap}
        if row.source == "demo":
            snap = upsert_dashboard_rollup(name)
            return {"product": name, "snapshot": snap}
        return {"product": name, "snapshot": _row_to_dict(row)}


@router.post("/refresh")
async def refresh_snapshot(product: str | None = None) -> dict[str, Any]:
    """Recompute today's dashboard rollup from live order + task data."""
    with session_scope() as s:
        name = _resolve_product(s, product)
        if not name:
            raise HTTPException(status_code=404, detail="no active product")
    snap = upsert_dashboard_rollup(name)
    return {"product": name, "snapshot": snap}


@router.post("/snapshot")
async def upsert_snapshot(body: SnapshotIn) -> dict[str, Any]:
    """Upsert today's snapshot. Keyed by (product, YYYY-MM-DD)."""
    today = date.today().isoformat()
    with session_scope() as s:
        name = _resolve_product(s, body.product)
        if not name:
            raise HTTPException(status_code=404, detail="no active product")
        row = s.get(DashboardSnapshotRow, {"product_name": name, "date": today})
        if row is None:
            row = DashboardSnapshotRow(product_name=name, date=today)
            s.add(row)
        row.today_sales = body.today_sales
        row.today_orders = body.today_orders
        row.today_roas = body.today_roas
        row.conversion_rate = body.conversion_rate
        row.avg_order_value = body.avg_order_value
        row.sales_trend = list(body.sales_trend)
        row.orders_trend = list(body.orders_trend)
        row.roas_trend = list(body.roas_trend)
        row.channel_performance = list(body.channel_performance)
        row.source = body.source
        row.measured_at = datetime.now(UTC)
        s.flush()
        return {"product": name, "snapshot": _row_to_dict(row)}
