"""Paperclip-style additions: org chart, goal ancestry, per-agent monthly budget.

Three layers verified end-to-end against the in-memory SQLite test DB:

- Org chart seed inserts the 5 default departments + 22 memberships.
- Goal CRUD + tree endpoint correctly resolves task counts and ancestors.
- Per-agent monthly budget enforcement: set limit → record spend until
  exhausted → ``is_agent_exhausted`` returns True.
"""
from __future__ import annotations

import httpx
import pytest
from httpx import ASGITransport, AsyncClient

from apps.api.core.budget import (
    is_agent_exhausted,
    record_agent_spend,
    remaining_agent_budget,
    set_agent_budget,
)
from apps.api.core.config import get_settings
from apps.api.core.db import init_db
from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import AgentBudgetRow, AgentOrgMembershipRow, OrgUnitRow
from apps.api.core.org import seed_default_org
from apps.api.main import create_app


def _fresh_app():
    get_settings.cache_clear()  # type: ignore[attr-defined]
    return create_app()


# ----------------------------------------------------------------------------
# Org chart
# ----------------------------------------------------------------------------


def test_seed_default_org_is_idempotent() -> None:
    init_db()
    seed_default_org()
    seed_default_org()  # second call must not duplicate rows
    with session_scope() as s:
        units = s.query(OrgUnitRow).all()
        members = s.query(AgentOrgMembershipRow).all()
    assert len(units) == 5
    # Every seed agent (22) must have exactly one membership row.
    assert len(members) == 22
    assert {u.id for u in units} == {"yonetim", "pazarlama", "operasyon", "finans", "arge"}
    # Heads are the supervisor / marketing / operations / pricing / market_research agents.
    heads = {u.id: u.head_agent_id for u in units}
    assert heads["yonetim"] == "supervisor"
    assert heads["pazarlama"] == "marketing_agent"


@pytest.mark.asyncio
async def test_org_units_endpoint_returns_seeded_units() -> None:
    app = _fresh_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Trigger lifespan so seed runs.
        async with httpx.AsyncClient() as _:
            pass
        # The test client invokes lifespan automatically on first request.
        resp = await client.get("/api/v1/org/units")
    assert resp.status_code == 200
    units = resp.json()
    assert len(units) == 5
    ids = {u["id"] for u in units}
    assert {"yonetim", "pazarlama", "operasyon", "finans", "arge"} == ids
    # Members are sorted & non-empty.
    yonetim = next(u for u in units if u["id"] == "yonetim")
    assert "supervisor" in yonetim["member_agent_ids"]


# ----------------------------------------------------------------------------
# Goals
# ----------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_goal_crud_and_tree() -> None:
    app = _fresh_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create root goal.
        r = await client.post("/api/v1/goals", json={"title": "Aylık ciroyu 2× artır", "target_metric": "revenue_try", "target_value": 100000})
        assert r.status_code == 200, r.text
        root = r.json()
        root_id = root["id"]
        assert root["parent_goal_id"] is None

        # Child goal.
        r = await client.post("/api/v1/goals", json={"title": "ROAS 3.0'a çıkar", "parent_goal_id": root_id})
        assert r.status_code == 200, r.text
        child_id = r.json()["id"]

        # Ancestors: root-first.
        r = await client.get(f"/api/v1/goals/{child_id}/ancestors")
        assert r.status_code == 200
        chain = r.json()
        assert [g["id"] for g in chain] == [root_id, child_id]

        # Tree exposes the nested shape.
        r = await client.get("/api/v1/goals/tree/full")
        assert r.status_code == 200
        tree = r.json()
        assert len(tree) >= 1
        root_node = next(n for n in tree if n["goal"]["id"] == root_id)
        assert any(c["goal"]["id"] == child_id for c in root_node["children"])

        # Invalid parent rejected.
        r = await client.post("/api/v1/goals", json={"title": "x", "parent_goal_id": "does_not_exist"})
        assert r.status_code == 400


# ----------------------------------------------------------------------------
# Per-agent monthly budget
# ----------------------------------------------------------------------------


def test_set_record_and_exhaust_agent_budget() -> None:
    init_db()
    agent_id = "test_agent_budget"
    # Reset any prior row from earlier test runs in the same process.
    with session_scope() as s:
        for row in s.query(AgentBudgetRow).filter(AgentBudgetRow.agent_id == agent_id).all():
            s.delete(row)

    # No budget configured → no enforcement.
    assert is_agent_exhausted(agent_id) is False
    assert remaining_agent_budget(agent_id) is None

    # Set $1 cap then burn through.
    set_agent_budget(agent_id, limit_usd=1.0)
    assert remaining_agent_budget(agent_id) == pytest.approx(1.0)
    record_agent_spend(agent_id, 0.4)
    assert remaining_agent_budget(agent_id) == pytest.approx(0.6)
    assert is_agent_exhausted(agent_id) is False

    record_agent_spend(agent_id, 0.7)  # overshoots — clamps to 0
    assert remaining_agent_budget(agent_id) == pytest.approx(0.0)
    assert is_agent_exhausted(agent_id) is True


@pytest.mark.asyncio
async def test_agent_budget_endpoints_roundtrip() -> None:
    app = _fresh_app()
    agent_id = "supervisor"  # exists in the seed
    # Clean any persisted row from earlier test runs (the dev SQLite DB is
    # shared across runs) so the "initial GET creates a zero-cap row"
    # invariant holds.
    init_db()
    with session_scope() as s:
        for row in s.query(AgentBudgetRow).filter(AgentBudgetRow.agent_id == agent_id).all():
            s.delete(row)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Initial GET creates a zero-cap row.
        r = await client.get(f"/api/v1/agents/{agent_id}/budget")
        assert r.status_code == 200
        body = r.json()
        assert body["agent_id"] == agent_id
        assert body["limit_usd"] == 0.0

        # PUT sets the cap.
        r = await client.put(
            f"/api/v1/agents/{agent_id}/budget",
            json={"limit_usd": 2.5, "warn_threshold_pct": 70},
        )
        assert r.status_code == 200
        body = r.json()
        assert body["limit_usd"] == 2.5
        assert body["warn_threshold_pct"] == 70
        assert body["exhausted"] is False

        # Unknown agent → 404.
        r = await client.put("/api/v1/agents/no_such_agent/budget", json={"limit_usd": 1})
        assert r.status_code == 404
