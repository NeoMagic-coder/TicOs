"""Skills API — exposes the learning-loop skill registry."""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter

from apps.api.core.skills.registry import get_skill_registry

router = APIRouter(tags=["skills"])


@router.get("/skills")
async def list_skills() -> list[dict[str, Any]]:
    """Return all learned skills ordered by usage count descending."""
    rows = get_skill_registry().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "description": r.description,
            "trigger_pattern": json.loads(r.trigger_pattern or "[]"),
            "tool_sequence": json.loads(r.tool_sequence or "[]"),
            "usage_count": r.usage_count,
            "success_rate": round(r.success_rate, 3),
            "last_used_at": r.last_used_at.isoformat() if r.last_used_at else None,
            "source_task_id": r.source_task_id,
        }
        for r in rows
    ]
