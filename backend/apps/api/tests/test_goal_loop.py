"""Tests for goal-driven autonomy loop."""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from apps.api.core.autonomy.goal_loop import (
    ensure_default_goals,
    find_stale_goals,
    get_loop_status,
    run_goal_loop_tick,
)
from apps.api.core.autonomy.runtime import patch_autonomy_mode
from apps.api.core.config import get_settings
from apps.api.core.db import session_scope
from apps.api.core.db.models import GoalRow, ProductRow
from apps.api.core.hermes.orchestrator import OrchestrationResult, RoutingDecision
from apps.api.main import create_app


@pytest.fixture(autouse=True)
def _enable_goal_loop():
    patch_autonomy_mode(enabled=True, auto_goal_loop=True)
    yield


def test_ensure_default_goals_seeds_when_empty() -> None:
    with session_scope() as s:
        for row in s.query(GoalRow).all():
            s.delete(row)
    created = ensure_default_goals(product_name="Test Ürün")
    assert len(created) == 3
    with session_scope() as s:
        count = s.query(GoalRow).count()
    assert count == 3


def test_find_stale_goals_includes_new_active_goal() -> None:
    gid = f"goal_{uuid.uuid4().hex[:12]}"
    with session_scope() as s:
        s.add(
            GoalRow(
                id=gid,
                title="Stale test goal",
                description="",
                status="active",
            )
        )
    stale = find_stale_goals(limit=10)
    assert any(g.id == gid for g in stale)


def test_get_loop_status_shape() -> None:
    status = get_loop_status()
    assert "active_goals" in status
    assert "stale_goals" in status
    assert "enabled" in status


@pytest.mark.asyncio
async def test_run_goal_loop_tick_skipped_without_product() -> None:
    with session_scope() as s:
        for row in s.query(ProductRow).all():
            s.delete(row)
    result = await run_goal_loop_tick(orchestrator=MagicMock())
    assert result.get("skipped") is True
    assert result.get("reason") == "no_active_product"


@pytest.mark.asyncio
async def test_run_goal_loop_tick_dispatches_with_mock_orchestrator() -> None:
    name = f"GoalLoop {uuid.uuid4().hex[:6]}"
    with session_scope() as s:
        for row in s.query(GoalRow).all():
            s.delete(row)
        s.add(ProductRow(name=name, category="Test", is_active=True))

    gid = ensure_default_goals(product_name=name)[0]
    mock = MagicMock()
    mock.handle = AsyncMock(
        return_value=OrchestrationResult(
            task_id=f"task_{uuid.uuid4().hex[:8]}",
            summary="Test özeti",
            routing=RoutingDecision(
                primary_agent="supervisor",
                supporting=[],
                rationale="test",
                urgency="low",
            ),
            graph={},
            confidence=0.9,
            escalated=False,
            tools_used=[],
        )
    )
    result = await run_goal_loop_tick(mock, goal_id=gid)
    assert result.get("dispatched") == 1
    assert mock.handle.await_count == 1


@pytest.mark.asyncio
async def test_run_goal_loop_tick_queues_approval_on_escalation() -> None:
    name = f"GoalEsc {uuid.uuid4().hex[:6]}"
    with session_scope() as s:
        for row in s.query(GoalRow).all():
            s.delete(row)
        s.add(ProductRow(name=name, category="Test", is_active=True))

    gid = ensure_default_goals(product_name=name)[0]
    mock = MagicMock()
    mock.handle = AsyncMock(
        return_value=OrchestrationResult(
            task_id=f"task_{uuid.uuid4().hex[:8]}",
            summary="Düşük güven — insan onayı gerekli.",
            routing=RoutingDecision(
                primary_agent="supervisor",
                supporting=[],
                rationale="test",
                urgency="low",
            ),
            graph={},
            confidence=0.3,
            escalated=True,
            tools_used=[],
        )
    )
    result = await run_goal_loop_tick(mock, goal_id=gid)
    assert result.get("dispatched") == 1
    entry = result["results"][0]
    assert entry.get("approval_id")
    assert entry.get("escalated") is True


@pytest.mark.asyncio
async def test_run_goal_loop_tick_queues_approval_when_policy_blocks() -> None:
    name = f"GoalPol {uuid.uuid4().hex[:6]}"
    with session_scope() as s:
        for row in s.query(GoalRow).all():
            s.delete(row)
        s.add(ProductRow(name=name, category="Test", is_active=True))

    gid = ensure_default_goals(product_name=name)[0]
    mock = MagicMock()
    mock.handle = AsyncMock()

    from apps.api.core.autonomy import goal_loop as gl

    original = gl._engine.evaluate

    def _needs_approval(**kwargs):
        from apps.api.core.autonomy.decision_engine import DecisionOutcome
        from datetime import UTC, datetime

        return DecisionOutcome(
            status="needs_approval",
            reason="test policy block",
            decision_id="dec_test",
            decided_at=datetime.now(UTC),
        )

    gl._engine.evaluate = _needs_approval  # type: ignore[method-assign]
    try:
        result = await run_goal_loop_tick(mock, goal_id=gid)
    finally:
        gl._engine.evaluate = original  # type: ignore[method-assign]

    assert result.get("dispatched") == 0
    entry = result["results"][0]
    assert entry.get("approval_id")
    assert entry.get("decision") == "needs_approval"
    mock.handle.assert_not_called()


@pytest.mark.asyncio
async def test_goals_overview_endpoint() -> None:
    """Overview route is registered before /{goal_id} and returns loop metadata."""
    ensure_default_goals(product_name="Overview Test")
    get_settings.cache_clear()  # type: ignore[attr-defined]
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/goals/overview")
        assert res.status_code == 200
        body = res.json()
        assert "goals" in body
        assert "loop" in body
        assert isinstance(body["goals"], list)
