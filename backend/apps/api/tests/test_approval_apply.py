"""Approve-applies-action loop: ``POST /approvals/{id}/approve`` must execute
the ``_apply`` tool call attached to the approval and persist the outcome
into ``params["_apply_result"]``.

Uses the real OpenClaw executor (mock/degraded tool modes), no LLM.
"""
from __future__ import annotations

import uuid

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from apps.api.core.config import get_settings
from apps.api.main import create_app
from apps.api.models.schemas import ApprovalRequest
from apps.api.services.task_store import get_approval_store
from apps.api.tools.live import register_all as register_live_tools


def _fresh_app():
    get_settings.cache_clear()  # type: ignore[attr-defined]
    return create_app()


@pytest_asyncio.fixture
async def client(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("API_KEY", raising=False)
    # ASGITransport doesn't run the lifespan, so live adapters (normally
    # registered there) must be registered explicitly — without Trendyol
    # credentials the breaker degrades them to mock.
    register_live_tools()
    app = _fresh_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def _make_approval(params: dict) -> ApprovalRequest:
    return get_approval_store().create(
        ApprovalRequest(
            id=f"apr_test_{uuid.uuid4().hex[:8]}",
            task_id="task_test",
            agent_id="marketing_agent",
            action="Test onayı",
            description="Apply-on-approve testi",
            params=params,
            risk_level="medium",
            expected_impact="",
        )
    )


@pytest.mark.asyncio
async def test_approve_executes_attached_tool(client: AsyncClient) -> None:
    ap = _make_approval(
        {
            "title": "LunaRest Uyku Spreyi 100ml",
            "_apply": {
                "tool_id": "trendyol_create_listing",
                "agent_id": "marketing_agent",
                "payload": {
                    "title": "LunaRest Uyku Spreyi 100ml",
                    "barcode": "DEMO-SKU-001",
                    "sale_price": 189.0,
                    "list_price": 217.35,
                    "quantity": 100,
                    "brand": "LunaRest",
                },
            },
        }
    )
    res = await client.post(f"/api/v1/approvals/{ap.id}/approve")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "approved"
    applied = data["params"].get("_apply_result")
    assert applied is not None, "approve must record an _apply_result block"
    assert applied["tool_id"] == "trendyol_create_listing"
    # No Trendyol credentials in tests — breaker degrades to mock, which is
    # still a successful execution from the approval's point of view.
    assert applied["status"] == "success"


@pytest.mark.asyncio
async def test_approve_without_apply_block_is_unchanged(client: AsyncClient) -> None:
    ap = _make_approval({"note": "sadece bilgi"})
    res = await client.post(f"/api/v1/approvals/{ap.id}/approve")
    assert res.status_code == 200
    assert "_apply_result" not in res.json()["params"]


@pytest.mark.asyncio
async def test_apply_failure_does_not_undo_approval(client: AsyncClient) -> None:
    ap = _make_approval(
        {"_apply": {"tool_id": "nonexistent_tool_xyz", "payload": {}}}
    )
    res = await client.post(f"/api/v1/approvals/{ap.id}/approve")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "approved"
    assert data["params"]["_apply_result"]["status"] == "failure"
