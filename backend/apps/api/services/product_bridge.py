"""Bridge workspace products (Ürün OS) to TicOS inventory (Envanter).

Keeps a single linked ``TicProductRow`` per onboarded ``ProductRow`` so
dashboard rollups, agent tools, and inventory screens stay in sync.
"""
from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select

from apps.api.core.db import session_scope
from apps.api.core.db.models import ProductRow
from apps.api.core.db.tic_models import TicOrderRow, TicProductRow, TicTenantRow
from apps.api.core.logging import get_logger
from apps.api.services.task_store import get_approval_store, get_task_store

log = get_logger(__name__)

_DEFAULT_TENANT_ID = "tenant_default"


def _commerce_status() -> str:
    try:
        from apps.api.core.commerce.orchestrator import get_commerce_orchestrator

        snap = get_commerce_orchestrator().get_snapshot()
        return str(snap.get("overall_status", "unknown"))
    except Exception:
        return "unknown"


def workspace_sku(product_name: str) -> str:
    slug = re.sub(r"[^A-Z0-9]+", "-", product_name.upper()).strip("-")[:40]
    return f"WS-{slug or 'PRODUCT'}"


def _ensure_tenant() -> str:
    with session_scope() as s:
        row = s.get(TicTenantRow, _DEFAULT_TENANT_ID)
        if row is None:
            row = TicTenantRow(
                id=_DEFAULT_TENANT_ID,
                name="Default Company",
                slug="default",
                plan="PRO",
            )
            s.add(row)
            s.flush()
        return row.id


def sync_workspace_product_to_inventory(product_name: str) -> dict[str, Any]:
    """Upsert a TicOS inventory row linked to the workspace product."""
    tenant_id = _ensure_tenant()
    sku = workspace_sku(product_name)

    with session_scope() as s:
        ws = s.get(ProductRow, product_name)
        if ws is None:
            return {"synced": False, "reason": "workspace_product_not_found", "product_name": product_name}

        existing = (
            s.execute(
                select(TicProductRow)
                .where(TicProductRow.tenant_id == tenant_id)
                .where(TicProductRow.workspace_product_name == product_name)
            )
            .scalar_one_or_none()
        )
        if existing is None:
            existing = (
                s.execute(
                    select(TicProductRow)
                    .where(TicProductRow.tenant_id == tenant_id)
                    .where(TicProductRow.sku == sku)
                )
                .scalar_one_or_none()
            )

        now = datetime.now(UTC)
        if existing is None:
            row = TicProductRow(
                id=f"tic_{uuid.uuid4().hex[:12]}",
                tenant_id=tenant_id,
                name=ws.name,
                description=ws.description or "",
                sku=sku,
                price=99.0,
                stock=0,
                category=ws.category or "",
                brand="",
                images=[ws.image_url] if ws.image_url and ws.image_url.startswith("http") else [],
                is_active=True,
                workspace_product_name=product_name,
                created_at=now,
                updated_at=now,
            )
            s.add(row)
            s.flush()
            log.info("product_bridge.created", product=product_name, sku=sku, tic_id=row.id)
            return {
                "synced": True,
                "created": True,
                "product_name": product_name,
                "tic_product_id": row.id,
                "sku": row.sku,
                "stock": row.stock,
            }

        existing.name = ws.name
        existing.description = ws.description or existing.description
        existing.category = ws.category or existing.category
        existing.workspace_product_name = product_name
        existing.is_active = True
        existing.updated_at = now
        if ws.image_url and ws.image_url.startswith("http"):
            existing.images = [ws.image_url]
        s.flush()
        log.info("product_bridge.updated", product=product_name, sku=existing.sku, tic_id=existing.id)
        return {
            "synced": True,
            "created": False,
            "product_name": product_name,
            "tic_product_id": existing.id,
            "sku": existing.sku,
            "stock": existing.stock,
        }


def get_workspace_integration_status(product_name: str | None = None) -> dict[str, Any]:
    """Aggregate cross-module status for the unified console."""
    tenant_id = _ensure_tenant()

    with session_scope() as s:
        active_row: ProductRow | None = None
        if product_name:
            active_row = s.get(ProductRow, product_name)
        if active_row is None:
            active_row = (
                s.execute(select(ProductRow).where(ProductRow.is_active.is_(True))).scalar_one_or_none()
            )
        if active_row is None:
            active_row = s.execute(select(ProductRow).order_by(ProductRow.onboarded_at.desc())).scalar_one_or_none()

        workspace_count = s.execute(select(func.count()).select_from(ProductRow)).scalar_one()

        tic_product_count = (
            s.execute(
                select(func.count())
                .select_from(TicProductRow)
                .where(TicProductRow.tenant_id == tenant_id)
            ).scalar_one()
        )
        tic_order_count = (
            s.execute(
                select(func.count())
                .select_from(TicOrderRow)
                .where(TicOrderRow.tenant_id == tenant_id)
            ).scalar_one()
        )

        linked: TicProductRow | None = None
        if active_row is not None:
            linked = (
                s.execute(
                    select(TicProductRow)
                    .where(TicProductRow.tenant_id == tenant_id)
                    .where(TicProductRow.workspace_product_name == active_row.name)
                )
                .scalar_one_or_none()
            )

    tasks = get_task_store().all()
    approvals = get_approval_store().all()
    active_statuses = {"in_progress", "assigned", "waiting_tool_result", "waiting_human_approval"}
    active_tasks = sum(
        1
        for t in tasks
        if (t.status.value if hasattr(t.status, "value") else str(t.status)) in active_statuses
    )
    pending_approvals = sum(
        1
        for a in approvals
        if (a.status.value if hasattr(a.status, "value") else str(a.status)) in {"pending", "estimating"}
    )

    active_product = None
    if active_row is not None:
        active_product = {
            "product_name": active_row.name,
            "category": active_row.category or "Genel",
            "stage": active_row.stage or "idea",
            "target_market": active_row.target_market or "TR",
            "is_active": bool(active_row.is_active),
        }

    inventory_link = None
    if linked is not None:
        inventory_link = {
            "tic_product_id": linked.id,
            "sku": linked.sku,
            "stock": linked.stock,
            "price": linked.price,
            "synced": True,
        }
    elif active_row is not None:
        inventory_link = {"synced": False, "expected_sku": workspace_sku(active_row.name)}

    return {
        "active_product": active_product,
        "modules": {
            "system": {
                "connected": True,
                "active_tasks": active_tasks,
                "pending_approvals": pending_approvals,
            },
            "agents": {
                "active_tasks": active_tasks,
                "pending_approvals": pending_approvals,
            },
            "product_os": {"workspace_products": workspace_count},
            "inventory": {
                "tic_products": tic_product_count,
                "tic_orders": tic_order_count,
                "link": inventory_link,
            },
            "ticosclaw": {"connected": True},
            "commerce_control": {
                "overall_status": _commerce_status(),
                "module_count": 6,
            },
        },
        "flows": _build_integration_flows(
            active_row=active_row,
            active_tasks=active_tasks,
            pending_approvals=pending_approvals,
            workspace_count=workspace_count,
            inventory_link=inventory_link,
            tic_order_count=tic_order_count,
        ),
    }


def _build_integration_flows(
    *,
    active_row: ProductRow | None,
    active_tasks: int,
    pending_approvals: int,
    workspace_count: int,
    inventory_link: dict[str, Any] | None,
    tic_order_count: int,
) -> list[dict[str, Any]]:
    """Ordered pipeline: Sistem → Ajan → Ürün OS → Envanter → TicOSClaw."""
    has_product = active_row is not None
    inventory_synced = bool(inventory_link and inventory_link.get("synced"))

    def node(module_id: str, label: str, page: str, ok: bool, detail: str) -> dict[str, Any]:
        return {
            "id": module_id,
            "label": label,
            "page": page,
            "ok": ok,
            "detail": detail,
        }

    return [
        node(
            "home",
            "Ana Sayfa",
            "dashboard",
            has_product,
            "Hoş geldin" if has_product else "Ürün ekle",
        ),
        node(
            "store",
            "Mağaza",
            "tic_products",
            inventory_synced,
            f"{tic_order_count} sipariş" if inventory_synced else "Envanter bağla",
        ),
        node(
            "assistant",
            "Asistan",
            "supervisor",
            has_product,
            "Sohbet" if has_product else "Ürün gerekli",
        ),
    ]
