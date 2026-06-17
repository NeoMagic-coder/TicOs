"""Tests for autonomy maintenance sweeps."""
from __future__ import annotations

import uuid

import pytest

from apps.api.core.autonomy.runtime import patch_autonomy_mode
from apps.api.core.autonomy.sweeps import sweep_inventory_sync, sweep_low_risk_approvals
from apps.api.core.db.models import ProductRow
from apps.api.core.db import session_scope
from apps.api.models.schemas import ApprovalRequest
from apps.api.services.product_bridge import workspace_sku
from apps.api.services.task_store import get_approval_store


@pytest.fixture(autouse=True)
def _enable_autonomy():
    patch_autonomy_mode(enabled=True, auto_sync=True, auto_approve_low_risk=True)
    yield
    patch_autonomy_mode(auto_approve_low_risk=False)


def test_sweep_inventory_sync_links_product() -> None:
    name = f"Sweep Test {uuid.uuid4().hex[:6]}"
    with session_scope() as s:
        s.add(
            ProductRow(
                name=name,
                description="sweep",
                category="Test",
                is_active=True,
            )
        )
    result = sweep_inventory_sync(active_only=True)
    assert result.get("skipped") is not True
    assert name in result.get("synced", [])
    assert workspace_sku(name).startswith("WS-")


def test_sweep_low_risk_approves_pending() -> None:
    store = get_approval_store()
    ap = ApprovalRequest(
        id=f"ap_{uuid.uuid4().hex[:8]}",
        task_id="task_test",
        agent_id="operations_agent",
        action="test_low_risk",
        description="test",
        params={},
        risk_level="low",
        expected_impact="",
        status="pending",
        reviewer_note=None,
        created_at="2026-01-01T00:00:00Z",
        resolved_at=None,
    )
    store.create(ap)
    result = sweep_low_risk_approvals()
    assert result.get("approved_count", 0) >= 1
    updated = store.get(ap.id)
    assert updated is not None
    assert updated.status == "approved"
