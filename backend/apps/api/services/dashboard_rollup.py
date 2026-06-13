"""Derive dashboard KPI snapshots from live TicOS order data + task counts."""
from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import select

from apps.api.core.db import session_scope
from apps.api.core.db.models import DashboardSnapshotRow
from apps.api.core.db.tic_models import TicOrderRow
from apps.api.services.task_store import get_approval_store, get_task_store

_DEFAULT_TENANT_ID = "tenant_default"
_EXCLUDED_STATUSES = frozenset({"CANCELLED", "CANCELED", "REFUNDED"})
_TR_MONTHS = ("Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara")


def _tr_date_label(d: date) -> str:
    return f"{d.day:02d} {_TR_MONTHS[d.month - 1]}"


def _order_day(order: TicOrderRow) -> date:
    ts = order.created_at
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=UTC)
    return ts.astimezone(UTC).date()


def compute_dashboard_rollup(product_name: str) -> dict[str, Any]:
    """Build a dashboard snapshot dict from tic_orders + task/approval stores."""
    today = datetime.now(UTC).date()
    window_start = today - timedelta(days=6)

    day_sales: dict[date, float] = defaultdict(float)
    day_orders: dict[date, int] = defaultdict(int)
    channel_sales: dict[str, float] = defaultdict(float)
    channel_orders: dict[str, int] = defaultdict(int)

    with session_scope() as s:
        rows = (
            s.execute(
                select(TicOrderRow)
                .where(TicOrderRow.tenant_id == _DEFAULT_TENANT_ID)
                .where(TicOrderRow.created_at >= datetime.combine(window_start, datetime.min.time(), tzinfo=UTC))
            )
            .scalars()
            .all()
        )

    for row in rows:
        if (row.status or "").upper() in _EXCLUDED_STATUSES:
            continue
        day = _order_day(row)
        amount = float(row.total_amount or 0.0)
        day_sales[day] += amount
        day_orders[day] += 1
        if day == today:
            platform = (row.platform or "MANUAL").strip() or "MANUAL"
            channel_sales[platform] += amount
            channel_orders[platform] += 1

    sales_trend: list[dict[str, Any]] = []
    orders_trend: list[int] = []
    roas_trend: list[float] = []
    for offset in range(6, -1, -1):
        d = today - timedelta(days=offset)
        sales = round(day_sales.get(d, 0.0), 2)
        orders = day_orders.get(d, 0)
        sales_trend.append({"date": _tr_date_label(d), "value": sales})
        orders_trend.append(orders)
        # ROAS requires ad-spend telemetry — leave zero until ads integrations feed it.
        roas_trend.append(0.0)

    today_sales = sales_trend[-1]["value"] if sales_trend else 0.0
    today_orders = orders_trend[-1] if orders_trend else 0
    avg_order_value = round(today_sales / today_orders, 2) if today_orders else 0.0

    channel_performance = [
        {
            "channel": platform,
            "sales": round(sales, 2),
            "orders": channel_orders[platform],
        }
        for platform, sales in sorted(channel_sales.items(), key=lambda x: -x[1])
    ]

    tasks = get_task_store().all()
    approvals = get_approval_store().all()
    active_tasks = sum(
        1
        for t in tasks
        if getattr(t, "status", "")
        in {"queued", "running", "in_progress", "assigned", "waiting_tool_result", "waiting_human_approval"}
    )
    pending_approvals = sum(1 for a in approvals if getattr(a, "status", "") in {"pending", "estimating"})

    return {
        "product": product_name,
        "date": today.isoformat(),
        "today_sales": today_sales,
        "today_orders": today_orders,
        "today_roas": 0.0,
        "conversion_rate": 0.0,
        "avg_order_value": avg_order_value,
        "active_campaigns": len(channel_performance),
        "active_tasks": active_tasks,
        "pending_approvals": pending_approvals,
        "sales_trend": sales_trend,
        "orders_trend": orders_trend,
        "roas_trend": roas_trend,
        "channel_performance": channel_performance,
        "source": "derived",
        "measured_at": datetime.now(UTC).isoformat(),
    }


def upsert_dashboard_rollup(product_name: str) -> dict[str, Any]:
    """Compute rollup from live data and persist to dashboard_snapshots."""
    payload = compute_dashboard_rollup(product_name)
    today = payload["date"]
    with session_scope() as s:
        row = s.get(DashboardSnapshotRow, {"product_name": product_name, "date": today})
        if row is None:
            row = DashboardSnapshotRow(product_name=product_name, date=today)
            s.add(row)
        row.today_sales = payload["today_sales"]
        row.today_orders = payload["today_orders"]
        row.today_roas = payload["today_roas"]
        row.conversion_rate = payload["conversion_rate"]
        row.avg_order_value = payload["avg_order_value"]
        row.sales_trend = list(payload["sales_trend"])
        row.orders_trend = list(payload["orders_trend"])
        row.roas_trend = list(payload["roas_trend"])
        row.channel_performance = list(payload["channel_performance"])
        row.source = payload["source"]
        row.measured_at = datetime.now(UTC)
        s.flush()
        payload["measured_at"] = row.measured_at.isoformat()
    return payload
