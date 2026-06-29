"""Live adapters for TicOS inventory / order tools — hit the real SQLite DB."""
from __future__ import annotations

from typing import Any

from sqlalchemy import func, select

from apps.api.core.db import session_scope
from apps.api.core.db.tic_models import TicOrderRow, TicProductRow
from apps.api.core.logging import get_logger
from apps.api.core.openclaw.executor import register_live_adapter
from apps.api.routes.tic_inventory import _ensure_tenant, _row_to_product
from apps.api.routes.tic_orders import _row_to_order

log = get_logger(__name__)

_DEFAULT_TENANT_ID = "tenant_default"


async def _tic_product_list(payload: dict[str, Any]) -> dict[str, Any]:
    tenant_id = _ensure_tenant()
    search = str(payload.get("search") or "").strip()
    category = str(payload.get("category") or "").strip()
    page = max(1, int(payload.get("page") or 1))
    page_size = min(100, max(1, int(payload.get("page_size") or 20)))
    with session_scope() as s:
        base = select(TicProductRow).where(TicProductRow.tenant_id == tenant_id)
        if search:
            like = f"%{search}%"
            base = base.where(TicProductRow.name.ilike(like) | TicProductRow.sku.ilike(like))
        if category:
            base = base.where(TicProductRow.category == category)
        total = s.execute(select(func.count()).select_from(base.subquery())).scalar() or 0
        rows = (
            s.execute(base.order_by(TicProductRow.updated_at.desc()).offset((page - 1) * page_size).limit(page_size))
            .scalars()
            .all()
        )
        data = [_row_to_product(r).model_dump() for r in rows]
    return {"data": data, "pagination": {"page": page, "page_size": page_size, "total": total}}


async def _tic_stock_check(payload: dict[str, Any]) -> dict[str, Any]:
    product_id = str(payload.get("product_id") or "")
    with session_scope() as s:
        row = s.get(TicProductRow, product_id)
        if row is None:
            return {"error": "not_found", "id": product_id}
        return {
            "id": row.id,
            "name": row.name,
            "sku": row.sku,
            "stock": row.stock,
            "price": row.price,
            "is_active": bool(row.is_active),
        }


async def _tic_order_list(payload: dict[str, Any]) -> dict[str, Any]:
    status = payload.get("status")
    platform = payload.get("platform")
    page = max(1, int(payload.get("page") or 1))
    page_size = min(100, max(1, int(payload.get("page_size") or 20)))
    with session_scope() as s:
        base = select(TicOrderRow).where(TicOrderRow.tenant_id == _DEFAULT_TENANT_ID)
        if status:
            base = base.where(TicOrderRow.status == str(status).upper())
        if platform:
            base = base.where(TicOrderRow.platform == str(platform).upper())
        total = s.execute(select(func.count()).select_from(base.subquery())).scalar() or 0
        rows = (
            s.execute(base.order_by(TicOrderRow.created_at.desc()).offset((page - 1) * page_size).limit(page_size))
            .scalars()
            .all()
        )
        data = [_row_to_order(r).model_dump() for r in rows]
    return {"data": data, "pagination": {"page": page, "page_size": page_size, "total": total}}


async def _tic_order_status_update(payload: dict[str, Any]) -> dict[str, Any]:
    order_id = str(payload.get("order_id") or "")
    status = str(payload.get("status") or "").upper()
    with session_scope() as s:
        row = s.get(TicOrderRow, order_id)
        if row is None:
            return {"error": "not_found", "id": order_id}
        row.status = status
        s.flush()
        return {"id": row.id, "order_number": row.order_number, "status": row.status}


async def _tic_dashboard_stats(_payload: dict[str, Any]) -> dict[str, Any]:
    from apps.api.routes.tic_dashboard import dashboard_stats

    stats = await dashboard_stats()
    return stats.model_dump()


async def _order_list(payload: dict[str, Any]) -> dict[str, Any]:
    result = await _tic_order_list(
        {
            "status": payload.get("status"),
            "page": 1,
            "page_size": min(100, int(payload.get("limit") or 50)),
        }
    )
    return {"orders": result.get("data") or [], "total": result.get("pagination", {}).get("total", 0)}


async def _stock_levels_query(payload: dict[str, Any]) -> dict[str, Any]:
    tenant_id = _ensure_tenant()
    threshold = payload.get("threshold")
    product_ids = payload.get("product_ids") or []
    with session_scope() as s:
        base = select(TicProductRow).where(TicProductRow.tenant_id == tenant_id, TicProductRow.is_active.is_(True))
        if product_ids:
            base = base.where(TicProductRow.id.in_([str(x) for x in product_ids]))
        if threshold is not None:
            base = base.where(TicProductRow.stock <= int(threshold))
        rows = s.execute(base).scalars().all()
        levels = [{"product_id": r.id, "sku": r.sku, "name": r.name, "stock": r.stock} for r in rows]
    return {"levels": levels}


_REGISTRATIONS = [
    ("tic_product_list", _tic_product_list),
    ("tic_stock_check", _tic_stock_check),
    ("tic_order_list", _tic_order_list),
    ("tic_order_status_update", _tic_order_status_update),
    ("tic_dashboard_stats", _tic_dashboard_stats),
    ("order_list", _order_list),
    ("stock_levels_query", _stock_levels_query),
]


def register() -> None:
    for tool_id, adapter in _REGISTRATIONS:
        register_live_adapter(tool_id, adapter)
    log.info("live.tic_inventory.registered", tools=len(_REGISTRATIONS))
