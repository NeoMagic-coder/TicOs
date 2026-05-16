"""Trajectory capture — records full tool-call sequences for research/fine-tuning.

Each step follows a simplified Anthropic tool-use message schema:
    {"role": "user"|"assistant"|"tool", "content": ..., "tool_calls": [...], "tool_results": [...]}

TrajectoryCapture is registered with the Hermes orchestrator and called after
each wave via a fire-and-forget task.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import TrajectoryRow
from apps.api.core.logging import get_logger
from apps.api.models.schemas import AgentOutput

log = get_logger(__name__)


def _make_step(
    *,
    role: str,
    content: str,
    tool_calls: list[dict[str, Any]] | None = None,
    tool_results: list[dict[str, Any]] | None = None,
    agent_id: str | None = None,
    confidence: float | None = None,
) -> dict[str, Any]:
    step: dict[str, Any] = {"role": role, "content": content}
    if tool_calls:
        step["tool_calls"] = tool_calls
    if tool_results:
        step["tool_results"] = tool_results
    if agent_id:
        step["agent_id"] = agent_id
    if confidence is not None:
        step["confidence"] = confidence
    return step


class TrajectoryCapture:
    """Append trajectory steps for a task and persist when complete."""

    def __init__(self, task_id: str, user_message: str) -> None:
        self.task_id = task_id
        self.traj_id = f"traj_{uuid.uuid4().hex[:12]}"
        self._steps: list[dict[str, Any]] = [
            _make_step(role="user", content=user_message)
        ]

    def record_agent_output(self, output: AgentOutput, tool_ids: list[str]) -> None:
        """Append an agent's output + the tools it called as one step."""
        tool_calls = [{"tool_id": t} for t in tool_ids]
        self._steps.append(
            _make_step(
                role="assistant",
                content=output.content or output.summary or "",
                tool_calls=tool_calls or None,
                agent_id=output.agent_id,
                confidence=output.confidence,
            )
        )

    def finalize(self, *, summary: str, confidence: float) -> None:
        """Persist the trajectory with the final merged summary as the last step."""
        self._steps.append(_make_step(role="assistant", content=summary))
        _persist(self.traj_id, self.task_id, self._steps, quality_score=confidence)

    @property
    def steps(self) -> list[dict[str, Any]]:
        return list(self._steps)


def _persist(
    traj_id: str,
    task_id: str,
    steps: list[dict[str, Any]],
    *,
    quality_score: float,
) -> None:
    try:
        with session_scope() as db:
            row = TrajectoryRow(
                id=traj_id,
                task_id=task_id,
                steps=steps,
                quality_score=round(quality_score, 4),
                created_at=datetime.now(UTC),
            )
            db.add(row)
        log.info("trajectory.saved", traj_id=traj_id, steps=len(steps), quality=round(quality_score, 3))
    except Exception as exc:
        log.warning("trajectory.save_failed", traj_id=traj_id, error=str(exc)[:120])


def get_trajectory(task_id: str) -> dict[str, Any] | None:
    with session_scope() as db:
        from sqlalchemy import select
        row = db.execute(
            select(TrajectoryRow).where(TrajectoryRow.task_id == task_id)
        ).scalars().first()
        if row is None:
            return None
        return {
            "id": row.id,
            "task_id": row.task_id,
            "steps": row.steps,
            "compressed_steps": row.compressed_steps,
            "quality_score": row.quality_score,
            "exported_at": row.exported_at.isoformat() if row.exported_at else None,
            "created_at": row.created_at.isoformat(),
        }
