"""Tests for workspace ↔ inventory product bridge."""
from __future__ import annotations

import pytest

from apps.api.core.db.models import ProductRow
from apps.api.core.db import session_scope
from apps.api.services.product_bridge import (
    get_workspace_integration_status,
    sync_workspace_product_to_inventory,
    workspace_sku,
)


def test_workspace_sku_slug() -> None:
    assert workspace_sku("Granit Pro Tencere").startswith("WS-")
    assert "GRANIT" in workspace_sku("Granit Pro Tencere")


def test_sync_creates_linked_inventory_row() -> None:
    name = "Bridge Test Ürün"
    with session_scope() as s:
        existing = s.get(ProductRow, name)
        if existing:
            s.delete(existing)
    with session_scope() as s:
        s.add(
            ProductRow(
                name=name,
                description="Test açıklama",
                category="Ev & Mutfak",
                is_active=True,
            )
        )
    result = sync_workspace_product_to_inventory(name)
    assert result["synced"] is True
    assert result["sku"] == workspace_sku(name)

    status = get_workspace_integration_status(name)
    assert status["active_product"]["product_name"] == name
    assert status["modules"]["inventory"]["link"]["synced"] is True
    assert status["modules"]["inventory"]["link"]["sku"] == workspace_sku(name)
