"""Trajectory compressor — strips redundant/retried steps via LLM.

Compressed trajectories keep only the successful tool-call path, making
them suitable for fine-tuning datasets where quality matters more than
completeness.
"""
from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import TrajectoryRow
from apps.api.core.llm.provider import LLMMessage, get_llm_provider
from apps.api.core.logging import get_logger

log = get_logger(__name__)

_COMPRESS_PROMPT = """\
You are a trajectory editor for tool-use training data.

Given a sequence of steps (JSON array), remove:
1. Retry attempts that were superseded by successful ones.
2. Redundant tool calls whose outputs weren't used in the final answer.
3. Internal deliberation steps with no tool calls and low confidence.

Keep ALL successful tool calls and the final user-facing answer.

Return ONLY the compressed JSON array — no explanation, no markdown fencing.

Steps:
{steps}
"""


async def compress(trajectory_id: str) -> bool:
    """Compress a trajectory in-place. Returns True on success."""
    with session_scope() as db:
        row = db.get(TrajectoryRow, trajectory_id)
        if row is None:
            log.warning("compressor.not_found", id=trajectory_id)
            return False
        steps_json = json.dumps(row.steps, ensure_ascii=False)

    llm = get_llm_provider()
    try:
        resp = await llm.complete([
            LLMMessage(
                role="user",
                content=_COMPRESS_PROMPT.format(steps=steps_json[:8000]),
            )
        ])
        raw = (resp.content or "").strip()
        # Strip optional code fence
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        compressed = json.loads(raw)
        if not isinstance(compressed, list):
            raise ValueError("LLM returned non-array")
    except Exception as exc:
        log.warning("compressor.llm_failed", id=trajectory_id, error=str(exc)[:200])
        return False

    with session_scope() as db:
        row = db.get(TrajectoryRow, trajectory_id)
        if row:
            row.compressed_steps = compressed
            log.info(
                "trajectory.compressed",
                id=trajectory_id,
                original=len(row.steps),
                compressed=len(compressed),
            )
    return True


def mark_exported(trajectory_ids: list[str]) -> None:
    now = datetime.now(UTC)
    with session_scope() as db:
        for tid in trajectory_ids:
            row = db.get(TrajectoryRow, tid)
            if row:
                row.exported_at = now


def list_trajectories(
    *,
    min_quality: float = 0.0,
    unexported_only: bool = False,
    limit: int = 200,
) -> list[dict[str, Any]]:
    from sqlalchemy import select, and_
    with session_scope() as db:
        q = select(TrajectoryRow).where(TrajectoryRow.quality_score >= min_quality)
        if unexported_only:
            q = q.where(TrajectoryRow.exported_at.is_(None))
        q = q.order_by(TrajectoryRow.created_at.desc()).limit(limit)
        rows = db.execute(q).scalars().all()
    return [
        {
            "id": r.id,
            "task_id": r.task_id,
            "steps_count": len(r.steps),
            "compressed_steps_count": len(r.compressed_steps) if r.compressed_steps else None,
            "quality_score": r.quality_score,
            "exported_at": r.exported_at.isoformat() if r.exported_at else None,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
