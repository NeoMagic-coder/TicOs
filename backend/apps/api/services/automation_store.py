"""CRUD service for user-defined scheduled automations (ScheduledJobRow)."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select

from apps.api.core.db.engine import session_scope
from apps.api.core.db.models import ScheduledJobRow
from apps.api.core.logging import get_logger

log = get_logger(__name__)


def _row_to_dict(row: ScheduledJobRow) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name,
        "prompt": row.prompt,
        "schedule_expr": row.schedule_expr,
        "agent_hint": row.agent_hint,
        "delivery_platform": row.delivery_platform,
        "delivery_target": row.delivery_target,
        "enabled": row.enabled,
        "last_run_at": row.last_run_at.isoformat() if row.last_run_at else None,
        "next_run_at": row.next_run_at.isoformat() if row.next_run_at else None,
        "last_status": row.last_status,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


class AutomationStore:
    """Thin CRUD wrapper around ScheduledJobRow."""

    def all(self) -> list[dict[str, Any]]:
        with session_scope() as s:
            rows = s.execute(select(ScheduledJobRow).order_by(ScheduledJobRow.created_at)).scalars().all()
            return [_row_to_dict(r) for r in rows]

    def get(self, job_id: str) -> dict[str, Any] | None:
        with session_scope() as s:
            row = s.get(ScheduledJobRow, job_id)
            return _row_to_dict(row) if row else None

    def create(
        self,
        *,
        name: str,
        prompt: str,
        schedule_expr: str,
        agent_hint: str | None = None,
        delivery_platform: str = "web",
        delivery_target: str = "",
    ) -> dict[str, Any]:
        job_id = f"job_{uuid.uuid4().hex[:12]}"
        with session_scope() as s:
            row = ScheduledJobRow(
                id=job_id,
                name=name,
                prompt=prompt,
                schedule_expr=schedule_expr,
                agent_hint=agent_hint,
                delivery_platform=delivery_platform,
                delivery_target=delivery_target,
                enabled=True,
                last_status="never",
                created_at=datetime.now(UTC),
            )
            s.add(row)
            s.flush()
            return _row_to_dict(row)

    def update(self, job_id: str, **kwargs: Any) -> dict[str, Any] | None:
        allowed = {"name", "prompt", "schedule_expr", "agent_hint",
                   "delivery_platform", "delivery_target", "enabled"}
        with session_scope() as s:
            row = s.get(ScheduledJobRow, job_id)
            if row is None:
                return None
            for key, val in kwargs.items():
                if key in allowed:
                    setattr(row, key, val)
            s.flush()
            return _row_to_dict(row)

    def delete(self, job_id: str) -> bool:
        with session_scope() as s:
            row = s.get(ScheduledJobRow, job_id)
            if row is None:
                return False
            s.delete(row)
            return True

    def mark_run(self, job_id: str, *, status: str) -> None:
        with session_scope() as s:
            row = s.get(ScheduledJobRow, job_id)
            if row:
                row.last_run_at = datetime.now(UTC)
                row.last_status = status
                s.flush()


_store: AutomationStore | None = None


def get_automation_store() -> AutomationStore:
    global _store
    if _store is None:
        _store = AutomationStore()
    return _store
