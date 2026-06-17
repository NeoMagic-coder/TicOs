"""Goal ancestry endpoints (Paperclip-2).

Goals form a tree (``parent_goal_id``) and tasks link to leaf goals via
``TaskRow.goal_id``. The tree endpoint is what the UI uses to render the
"why" breadcrumb — every task can be traced back to a top-level goal.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select

from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import GoalRow, TaskRow
from apps.api.models.schemas import Goal, GoalCreate, GoalNode

router = APIRouter(prefix="/goals", tags=["goals"])


def _row_to_goal(row: GoalRow) -> Goal:
    return Goal(
        id=row.id,
        parent_goal_id=row.parent_goal_id,
        title=row.title,
        description=row.description,
        owner_agent_id=row.owner_agent_id,
        owner_org_unit_id=row.owner_org_unit_id,
        target_metric=row.target_metric,
        target_value=row.target_value,
        current_value=row.current_value,
        status=row.status,  # type: ignore[arg-type]
        deadline=row.deadline,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


@router.get("", response_model=list[Goal])
async def list_goals(status: str | None = None) -> list[Goal]:
    with session_scope() as s:
        q = select(GoalRow).order_by(GoalRow.created_at)
        if status:
            q = q.where(GoalRow.status == status)
        return [_row_to_goal(r) for r in s.execute(q).scalars().all()]


@router.post("", response_model=Goal)
async def create_goal(payload: GoalCreate) -> Goal:
    goal_id = f"goal_{uuid.uuid4().hex[:12]}"
    now = datetime.now(UTC)
    with session_scope() as s:
        # Validate parent exists (if supplied) — avoids dangling tree edges.
        if payload.parent_goal_id:
            parent = s.get(GoalRow, payload.parent_goal_id)
            if parent is None:
                raise HTTPException(status_code=400, detail="parent_goal_id does not exist")
        row = GoalRow(
            id=goal_id,
            parent_goal_id=payload.parent_goal_id,
            title=payload.title.strip(),
            description=payload.description,
            owner_agent_id=payload.owner_agent_id,
            owner_org_unit_id=payload.owner_org_unit_id,
            target_metric=payload.target_metric,
            target_value=payload.target_value,
            deadline=payload.deadline,
            created_at=now,
            updated_at=now,
        )
        s.add(row)
        s.flush()
        return _row_to_goal(row)


@router.get("/overview")
async def goals_overview() -> dict[str, Any]:
    """Compact goal progress for dashboard + autonomy widgets."""
    from apps.api.core.autonomy.goal_loop import get_loop_status

    with session_scope() as s:
        rows = s.execute(
            select(GoalRow).where(GoalRow.status == "active").order_by(GoalRow.created_at)
        ).scalars().all()
        counts_rows = s.execute(
            select(TaskRow.goal_id, func.count(TaskRow.task_id))
            .where(TaskRow.goal_id.is_not(None))
            .group_by(TaskRow.goal_id)
        ).all()
        counts: dict[str, int] = {gid: c for (gid, c) in counts_rows}

    stale_ids = {g["id"] for g in get_loop_status().get("stale_goals", [])}
    roots = [r for r in rows if not r.parent_goal_id][:5]
    goals: list[dict[str, Any]] = []
    for row in roots:
        progress_pct: float | None = None
        if row.target_value and row.current_value is not None and row.target_value > 0:
            progress_pct = min(100.0, round(row.current_value / row.target_value * 100, 1))
        goals.append(
            {
                "id": row.id,
                "title": row.title,
                "target_metric": row.target_metric,
                "target_value": row.target_value,
                "current_value": row.current_value,
                "progress_pct": progress_pct,
                "task_count": counts.get(row.id, 0),
                "owner_agent_id": row.owner_agent_id,
                "stale": row.id in stale_ids,
            }
        )
    return {"goals": goals, "loop": get_loop_status()}


@router.get("/{goal_id}", response_model=Goal)
async def get_goal(goal_id: str) -> Goal:
    with session_scope() as s:
        row = s.get(GoalRow, goal_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Goal not found")
        return _row_to_goal(row)


@router.patch("/{goal_id}", response_model=Goal)
async def update_goal(goal_id: str, patch: dict[str, Any]) -> Goal:
    allowed = {"title", "description", "status", "owner_agent_id", "owner_org_unit_id",
               "target_metric", "target_value", "current_value", "deadline"}
    with session_scope() as s:
        row = s.get(GoalRow, goal_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Goal not found")
        for k, v in patch.items():
            if k in allowed:
                setattr(row, k, v)
        row.updated_at = datetime.now(UTC)
        s.flush()
        return _row_to_goal(row)


@router.delete("/{goal_id}")
async def delete_goal(goal_id: str) -> dict[str, str]:
    with session_scope() as s:
        row = s.get(GoalRow, goal_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Goal not found")
        s.delete(row)
    return {"deleted": goal_id}


@router.get("/{goal_id}/ancestors", response_model=list[Goal])
async def get_ancestors(goal_id: str) -> list[Goal]:
    """Walk up the parent chain — root first. Used by task detail to render
    a breadcrumb of why a given task exists."""
    chain: list[Goal] = []
    visited: set[str] = set()
    with session_scope() as s:
        cursor: GoalRow | None = s.get(GoalRow, goal_id)
        if cursor is None:
            raise HTTPException(status_code=404, detail="Goal not found")
        while cursor is not None and cursor.id not in visited:
            visited.add(cursor.id)
            chain.append(_row_to_goal(cursor))
            if cursor.parent_goal_id is None:
                break
            cursor = s.get(GoalRow, cursor.parent_goal_id)
    chain.reverse()
    return chain


@router.get("/tree/full", response_model=list[GoalNode])
async def get_goal_tree() -> list[GoalNode]:
    """Materialise the full goal forest with per-goal task counts.

    Cheap by design — runs one ``SELECT * FROM goals`` plus one grouped
    count over tasks. Re-evaluate if either table exceeds a few thousand
    rows.
    """
    with session_scope() as s:
        rows = s.execute(select(GoalRow).order_by(GoalRow.created_at)).scalars().all()
        counts_rows = s.execute(
            select(TaskRow.goal_id, func.count(TaskRow.task_id))
            .where(TaskRow.goal_id.is_not(None))
            .group_by(TaskRow.goal_id)
        ).all()
        counts: dict[str, int] = {gid: c for (gid, c) in counts_rows}

    nodes_by_id: dict[str, GoalNode] = {
        r.id: GoalNode(goal=_row_to_goal(r), children=[], task_count=counts.get(r.id, 0))
        for r in rows
    }
    roots: list[GoalNode] = []
    for r in rows:
        node = nodes_by_id[r.id]
        if r.parent_goal_id and r.parent_goal_id in nodes_by_id:
            nodes_by_id[r.parent_goal_id].children.append(node)
        else:
            roots.append(node)
    return roots
