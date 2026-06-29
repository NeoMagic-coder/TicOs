"""Sub-agent runner — isolated single-agent execution with its own budget slice.

A sub-agent has:
- A fresh ExecutionContext (separate audit log, separate cost counter).
- A budget capped at min(requested, parent_remaining * 0.5) to prevent
  a single sub-agent from exhausting the parent's entire budget.
- No access to the parent's TaskGraph state.
- Memory writes land in the same DB, tagged with child_task_id.
"""
from __future__ import annotations

import asyncio
import uuid
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

from apps.api.agents.registry import get_agent_registry
from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import SubagentRow
from apps.api.core.logging import get_logger
from apps.api.core.openclaw.executor import ExecutionContext, get_executor
from apps.api.models.schemas import AgentOutput

log = get_logger(__name__)

EventSink = Callable[[dict[str, Any]], Awaitable[None]]

_MAX_BUDGET_FRACTION = 0.5  # sub-agent may use at most 50% of parent's remaining budget


class SubagentRunner:
    """Runs a single agent in isolation and records the result in SubagentRow."""

    def __init__(self) -> None:
        self._agents = get_agent_registry()
        self._executor = get_executor()

    async def run(
        self,
        *,
        message: str,
        agent_id: str,
        parent_task_id: str,
        product_context: dict[str, Any] | None = None,
        allowed_tools: list[str] | None = None,
        budget_usd: float = 0.05,
        parent_remaining_usd: float | None = None,
        event_sink: EventSink | None = None,
    ) -> AgentOutput:
        """Run the sub-agent and return its AgentOutput."""
        agent = self._agents.get(agent_id)
        if agent is None:
            raise ValueError(f"Unknown agent: {agent_id!r}")

        # Cap budget to prevent sub-agent from draining parent
        if parent_remaining_usd is not None:
            budget_usd = min(budget_usd, parent_remaining_usd * _MAX_BUDGET_FRACTION)
        budget_usd = max(budget_usd, 0.001)  # always allow at least $0.001

        child_task_id = f"sub_{uuid.uuid4().hex[:10]}"
        row_id = f"sub_{uuid.uuid4().hex[:12]}"
        now = datetime.now(UTC)

        # Persist start record
        _write_row(SubagentRow(
            id=row_id,
            parent_task_id=parent_task_id,
            child_task_id=child_task_id,
            agent_id=agent_id,
            message=message[:500],
            status="running",
            budget_usd=budget_usd,
            created_at=now,
        ))

        async def _emit(event: str, **data: Any) -> None:
            if event_sink:
                try:
                    await event_sink({"event": f"subagent.{event}", "subagent_id": child_task_id, "agent_id": agent_id, **data})
                except Exception:
                    pass

        await _emit("started", message=message[:120], budget_usd=round(budget_usd, 4))
        ctx = ExecutionContext(
            agent_id=agent_id,
            task_id=child_task_id,
            budget_usd=budget_usd,
        )

        log.info("subagent.start", parent=parent_task_id, child=child_task_id, agent=agent_id)
        status = "failed"
        cost_usd = 0.0
        output: AgentOutput | None = None

        try:
            output = await agent.run(
                message=message,
                history=[],
                product_context=product_context or {},
                executor=self._executor,
                ctx=ctx,
            )
            cost_usd = ctx.cost_so_far_usd
            status = output.status

            # Emit tool events for transparency in SSE stream
            for entry in ctx.audit:
                await _emit("tool_called", tool_id=entry.tool_id, status=entry.status)

            await _emit(
                "completed",
                status=output.status,
                confidence=round(output.confidence, 3),
                cost_usd=round(cost_usd, 6),
                summary=(output.summary or "")[:200],
            )
            log.info("subagent.done", parent=parent_task_id, child=child_task_id, status=status)
            return output

        except Exception as exc:
            log.warning("subagent.failed", parent=parent_task_id, child=child_task_id, error=str(exc)[:200])
            await _emit("failed", error=str(exc)[:200])
            raise

        finally:
            _update_row(row_id, status=status, cost_usd=cost_usd, output=output)

    def get_runs(self, parent_task_id: str) -> list[dict[str, Any]]:
        """Return all sub-agent runs for a given parent task."""
        from sqlalchemy import select
        with session_scope() as db:
            rows = db.execute(
                select(SubagentRow).where(SubagentRow.parent_task_id == parent_task_id)
            ).scalars().all()
        return [_row_to_dict(r) for r in rows]


def _write_row(row: SubagentRow) -> None:
    try:
        with session_scope() as db:
            db.add(row)
    except Exception as exc:
        log.warning("subagent.write_failed", error=str(exc)[:120])


def _update_row(row_id: str, *, status: str, cost_usd: float, output: AgentOutput | None) -> None:
    try:
        with session_scope() as db:
            row = db.get(SubagentRow, row_id)
            if row:
                row.status = status
                row.cost_usd = cost_usd
                row.confidence = output.confidence if output else 0.0
                row.summary = (output.summary or "")[:500] if output else None
                row.completed_at = datetime.now(UTC)
    except Exception as exc:
        log.warning("subagent.update_failed", error=str(exc)[:120])


def _row_to_dict(row: SubagentRow) -> dict[str, Any]:
    return {
        "id": row.id,
        "parent_task_id": row.parent_task_id,
        "child_task_id": row.child_task_id,
        "agent_id": row.agent_id,
        "message": row.message,
        "status": row.status,
        "budget_usd": row.budget_usd,
        "cost_usd": row.cost_usd,
        "confidence": row.confidence,
        "summary": row.summary,
        "created_at": row.created_at.isoformat(),
        "completed_at": row.completed_at.isoformat() if row.completed_at else None,
    }


_runner: SubagentRunner | None = None


def get_subagent_runner() -> SubagentRunner:
    global _runner
    if _runner is None:
        _runner = SubagentRunner()
    return _runner
