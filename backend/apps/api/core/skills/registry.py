"""SkillRegistry — in-memory index of learned skills, backed by the DB.

Compatible with the agentskills.io open standard (id, name, description,
trigger_pattern, tool_sequence fields map 1-to-1 to the spec schema).
"""
from __future__ import annotations

import hashlib
import json
from functools import lru_cache

from sqlalchemy import select

from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import SkillRow
from apps.api.core.logging import get_logger

log = get_logger(__name__)


def _sequence_hash(tool_sequence: list[str]) -> str:
    return hashlib.sha256(json.dumps(tool_sequence, sort_keys=True).encode()).hexdigest()[:16]


class SkillRegistry:
    def all(self) -> list[SkillRow]:
        with session_scope() as db:
            return list(db.execute(select(SkillRow).order_by(SkillRow.usage_count.desc())).scalars().all())

    def get(self, skill_id: str) -> SkillRow | None:
        with session_scope() as db:
            return db.get(SkillRow, skill_id)

    def upsert(
        self,
        *,
        name: str,
        description: str,
        trigger_pattern: list[str],
        tool_sequence: list[str],
        source_task_id: str,
        success: bool = True,
    ) -> str:
        """Create or update a skill. Dedup by tool_sequence hash. Returns skill_id."""
        skill_id = f"skill_{_sequence_hash(tool_sequence)}"
        try:
            with session_scope() as db:
                existing = db.get(SkillRow, skill_id)
                if existing:
                    existing.usage_count += 1
                    n = existing.usage_count
                    # Running mean for success rate
                    existing.success_rate = existing.success_rate + (float(success) - existing.success_rate) / n
                else:
                    db.add(SkillRow(
                        id=skill_id,
                        name=name,
                        description=description,
                        trigger_pattern=json.dumps(trigger_pattern),
                        tool_sequence=json.dumps(tool_sequence),
                        usage_count=1,
                        success_rate=1.0 if success else 0.0,
                        source_task_id=source_task_id,
                    ))
            log.info("skill.upserted", skill_id=skill_id, name=name)
        except Exception as exc:
            log.warning("skill.upsert_failed", skill_id=skill_id, error=str(exc)[:200])
        return skill_id


@lru_cache(maxsize=1)
def get_skill_registry() -> SkillRegistry:
    return SkillRegistry()
