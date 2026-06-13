"""Cross-module workspace integration endpoints."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from apps.api.core.db import session_scope
from apps.api.core.db.models import ProductRow
from apps.api.services.product_bridge import (
    get_workspace_integration_status,
    sync_workspace_product_to_inventory,
)

router = APIRouter(prefix="/workspace", tags=["workspace"])


@router.get("/status")
async def workspace_status(product: str | None = Query(None, max_length=200)) -> dict[str, Any]:
    """Unified status across Sistem, Ajan Altyapısı, Ürün OS, Envanter and TicOSClaw."""
    return get_workspace_integration_status(product)


@router.post("/sync")
async def workspace_sync(product: str | None = Query(None, max_length=200)) -> dict[str, Any]:
    """Link the active (or named) workspace product to TicOS inventory."""
    name = product
    if not name:
        from sqlalchemy import select

        with session_scope() as s:
            row = s.execute(select(ProductRow).where(ProductRow.is_active.is_(True))).scalar_one_or_none()
            if row is None:
                row = s.execute(select(ProductRow).order_by(ProductRow.onboarded_at.desc())).scalar_one_or_none()
            if row is None:
                raise HTTPException(status_code=404, detail="No workspace product to sync")
            name = row.name
    result = sync_workspace_product_to_inventory(name)
    if not result.get("synced"):
        raise HTTPException(status_code=404, detail=result.get("reason", "sync_failed"))
    status = get_workspace_integration_status(name)
    return {"sync": result, "status": status}
