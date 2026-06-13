"""Tests for live dashboard rollup from tic_orders."""
from __future__ import annotations

from datetime import UTC, datetime
import uuid

import pytest
from sqlalchemy import select

from apps.api.core.db import session_scope
from apps.api.core.db.tic_models import TicCustomerRow, TicOrderRow, TicTenantRow
from apps.api.services.dashboard_rollup import compute_dashboard_rollup, upsert_dashboard_rollup


@pytest.fixture
def tic_order_setup():
    tenant_id = "tenant_default"
    customer_id = f"cust_{uuid.uuid4().hex[:8]}"
    order_id = f"ord_{uuid.uuid4().hex[:8]}"
    with session_scope() as s:
        if s.get(TicTenantRow, tenant_id) is None:
            s.add(TicTenantRow(id=tenant_id, name="Default", slug="default"))
        s.add(
            TicCustomerRow(
                id=customer_id,
                tenant_id=tenant_id,
                first_name="Test",
                last_name="User",
                email="test@example.com",
            )
        )
        s.add(
            TicOrderRow(
                id=order_id,
                tenant_id=tenant_id,
                order_number=f"TIC-TEST-{uuid.uuid4().hex[:6].upper()}",
                platform="SHOPIFY",
                status="COMPLETED",
                customer_id=customer_id,
                total_amount=250.0,
                created_at=datetime.now(UTC),
            )
        )
        s.flush()
    yield order_id
    with session_scope() as s:
        row = s.get(TicOrderRow, order_id)
        if row:
            s.delete(row)
        cust = s.get(TicCustomerRow, customer_id)
        if cust:
            s.delete(cust)


def test_compute_dashboard_rollup_from_orders(tic_order_setup):
    snap = compute_dashboard_rollup("Test Product")
    assert snap["source"] == "derived"
    assert snap["today_sales"] >= 250.0
    assert snap["today_orders"] >= 1
    assert len(snap["sales_trend"]) == 7
    channels = {c["channel"] for c in snap["channel_performance"]}
    assert "SHOPIFY" in channels


def test_upsert_overwrites_demo_source(tic_order_setup):
    product = "Test Product"
    snap = upsert_dashboard_rollup(product)
    assert snap["source"] == "derived"
    assert snap["today_orders"] >= 1

    with session_scope() as s:
        from apps.api.core.db.models import DashboardSnapshotRow

        row = s.execute(
            select(DashboardSnapshotRow).where(DashboardSnapshotRow.product_name == product)
        ).scalar_one()
        assert row.source == "derived"
