"""SkillBuilder — extracts reusable tool sequences from completed tasks.

Called fire-and-forget after the orchestrator merges agent outputs when:
  - confidence > 0.85
  - at least 3 distinct tools were used

The resulting skill is upserted into SkillRow via SkillRegistry.
"""
from __future__ import annotations

from typing import Any

from apps.api.core.logging import get_logger
from apps.api.core.skills.registry import get_skill_registry

log = get_logger(__name__)

_MIN_CONFIDENCE = 0.85
_MIN_TOOLS = 3


async def extract_from_task(
    *,
    task_id: str,
    message: str,
    tools_used: list[str],
    confidence: float,
    audit: list[Any],
) -> str | None:
    """Extract a skill from *task_id* if quality thresholds are met.

    Returns the skill_id on success, None if thresholds not met or on error.
    """
    if confidence < _MIN_CONFIDENCE:
        return None
    unique_tools = list(dict.fromkeys(tools_used))  # preserve order, dedup
    if len(unique_tools) < _MIN_TOOLS:
        return None

    # Derive trigger keywords from the first 10 words of the user message
    words = message.lower().split()[:10]
    trigger = [w for w in words if len(w) > 3][:5]

    # Build a short name from the dominant tool category (audit entries may be
    # ToolCallLog dataclasses or dicts depending on context)
    def _tool_id(e: Any) -> str:
        return e.tool_id if hasattr(e, "tool_id") else e.get("tool_id", "")

    def _status(e: Any) -> str:
        return e.status if hasattr(e, "status") else e.get("status", "")

    categories = [_tool_id(e).split("_")[0] for e in audit if _status(e) == "success"]
    dominant = max(set(categories), key=categories.count) if categories else "genel"
    name = f"{dominant}_skill_{task_id[-6:]}"
    description = f"'{message[:60]}' görevinden öğrenildi. Araçlar: {', '.join(unique_tools)}"

    try:
        skill_id = get_skill_registry().upsert(
            name=name,
            description=description,
            trigger_pattern=trigger,
            tool_sequence=unique_tools,
            source_task_id=task_id,
            success=confidence >= _MIN_CONFIDENCE,
        )
        return skill_id
    except Exception as exc:
        log.warning("skill.build_failed", task_id=task_id, error=str(exc)[:200])
        return None
