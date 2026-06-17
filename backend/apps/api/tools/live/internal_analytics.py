"""Live analytics adapters backed by dashboard rollup + tic_orders."""
from __future__ import annotations

from typing import Any

from apps.api.core.logging import get_logger
from apps.api.core.openclaw.executor import register_live_adapter
from apps.api.services.dashboard_rollup import compute_dashboard_rollup

log = get_logger(__name__)

_DEFAULT_PRODUCT = "active"


async def _analytics_sales_summary(_payload: dict[str, Any]) -> dict[str, Any]:
    snap = compute_dashboard_rollup(_DEFAULT_PRODUCT)
    return {
        "revenue": snap["today_sales"],
        "orders": snap["today_orders"],
        "aov": snap["avg_order_value"],
        "period": "today",
        "source": "derived",
    }


_REGISTRATIONS = [
    ("analytics_sales_summary", _analytics_sales_summary),
]


def register() -> None:
    for tool_id, adapter in _REGISTRATIONS:
        register_live_adapter(tool_id, adapter)
    log.info("live.internal_analytics.registered", tools=len(_REGISTRATIONS))
