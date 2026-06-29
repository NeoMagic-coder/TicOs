"""Lightweight autonomous maintenance sweeps (no LLM)."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select

from apps.api.core.autonomy.runtime import autonomy_enabled, get_autonomy_mode
from apps.api.core.db import session_scope
from apps.api.core.db.models import ProductRow
from apps.api.core.logging import get_logger
from apps.api.services.product_bridge import sync_workspace_product_to_inventory
from apps.api.services.task_store import get_approval_store

log = get_logger(__name__)

_LAST_SWEEPS: dict[str, Any] = {}


def last_sweep_results() -> dict[str, Any]:
    return dict(_LAST_SWEEPS)


def sweep_inventory_sync(*, active_only: bool = True) -> dict[str, Any]:
    """Sync workspace products to inventory rows."""
    mode = get_autonomy_mode()
    if not autonomy_enabled() or not mode.get("auto_sync", True):
        return {"skipped": True, "reason": "auto_sync_disabled"}

    synced: list[str] = []
    failed: list[str] = []
    with session_scope() as s:
        q = select(ProductRow)
        if active_only:
            q = q.where(ProductRow.is_active == True)  # noqa: E712
        names = [r.name for r in s.execute(q).scalars().all()]

    for name in names:
        try:
            result = sync_workspace_product_to_inventory(name)
            if result.get("synced"):
                synced.append(name)
            else:
                failed.append(name)
        except Exception as exc:
            log.warning("sweep.inventory.failed", product=name, error=str(exc)[:120])
            failed.append(name)

    payload = {
        "at": datetime.now(UTC).isoformat(),
        "synced": synced,
        "failed": failed,
        "count": len(synced),
    }
    _LAST_SWEEPS["inventory"] = payload
    log.info("sweep.inventory.done", synced=len(synced), failed=len(failed))
    return payload


def sweep_low_risk_approvals() -> dict[str, Any]:
    """Auto-approve pending approvals at low risk when enabled."""
    mode = get_autonomy_mode()
    if not autonomy_enabled() or not mode.get("auto_approve_low_risk", False):
        return {"skipped": True, "reason": "auto_approve_low_risk_disabled"}

    store = get_approval_store()
    approved: list[str] = []
    skipped = 0
    for ap in store.all():
        if ap.status not in {"pending", "estimating"}:
            continue
        if (ap.risk_level or "").lower() != "low":
            skipped += 1
            continue
        resolved = store.resolve(
            ap.id,
            status="approved",
            note="Otonom mod — düşük risk otomatik onay",
        )
        if resolved:
            approved.append(ap.id)

    payload = {
        "at": datetime.now(UTC).isoformat(),
        "approved": approved,
        "approved_count": len(approved),
        "skipped_non_low": skipped,
    }
    _LAST_SWEEPS["approvals"] = payload
    log.info("sweep.approvals.done", approved=len(approved), skipped=skipped)
    return payload


async def run_autonomy_pulse() -> dict[str, Any]:
    """Combined pulse: inventory sync + optional low-risk approvals."""
    inv = sweep_inventory_sync()
    appr = sweep_low_risk_approvals()
    return {"inventory": inv, "approvals": appr}
