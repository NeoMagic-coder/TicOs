"""SQLAlchemy-backed task & approval stores.

Public API matches the previous in-memory implementation so routes don't need
to change. Tasks and approvals persist to the database configured in
``apps.api.core.config.Settings.database_url`` (SQLite by default).
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from apps.api.core.db import session_scope
from apps.api.core.db.models import ApprovalRow, TaskRow
from apps.api.models.schemas import ApprovalRequest, Task, TaskCreate, TaskStatus


def _row_to_task(row: TaskRow) -> Task:
    return Task.model_validate(
        {
            "task_id": row.task_id,
            "parent_task_id": row.parent_task_id,
            "title": row.title,
            "description": row.description,
            "goal": row.goal,
            "status": row.status,
            "priority": row.priority,
            "assigned_agent_id": row.assigned_agent_id,
            "context": row.context or {},
            "constraints": row.constraints or [],
            "required_capabilities": row.required_capabilities or [],
            "max_iterations": row.max_iterations,
            "deadline": row.deadline,
            "approval_required": row.approval_required,
            "confidence": row.confidence,
            "iterations_used": row.iterations_used,
            "sub_tasks": row.sub_tasks or [],
            "created_at": row.created_at,
            "updated_at": row.updated_at,
            "completed_at": row.completed_at,
            "result": row.result,
        }
    )


def _row_to_approval(row: ApprovalRow) -> ApprovalRequest:
    return ApprovalRequest.model_validate(
        {
            "id": row.id,
            "task_id": row.task_id,
            "agent_id": row.agent_id,
            "action": row.action,
            "description": row.description,
            "params": row.params or {},
            "risk_level": row.risk_level,
            "expected_impact": row.expected_impact,
            "status": row.status,
            "reviewer_note": row.reviewer_note,
            "created_at": row.created_at,
            "resolved_at": row.resolved_at,
        }
    )


class TaskStore:
    def create(self, payload: TaskCreate) -> Task:
        task_id = f"task_{uuid.uuid4().hex[:8]}"
        now = datetime.now(UTC)
        with session_scope() as s:
            row = TaskRow(
                task_id=task_id,
                title=payload.title,
                description=payload.description,
                goal=payload.goal,
                priority=payload.priority.value,
                context=payload.context,
                deadline=payload.deadline,
                created_at=now,
                updated_at=now,
            )
            s.add(row)
            s.flush()
            return _row_to_task(row)

    def get(self, task_id: str) -> Task | None:
        with session_scope() as s:
            row = s.get(TaskRow, task_id)
            return _row_to_task(row) if row else None

    def all(self) -> list[Task]:
        with session_scope() as s:
            rows = s.query(TaskRow).order_by(TaskRow.created_at.desc()).all()
            return [_row_to_task(r) for r in rows]

    def update_status(self, task_id: str, status: TaskStatus) -> Task | None:
        with session_scope() as s:
            row = s.get(TaskRow, task_id)
            if not row:
                return None
            row.status = status.value
            row.updated_at = datetime.now(UTC)
            if status in {TaskStatus.completed, TaskStatus.failed, TaskStatus.escalated}:
                row.completed_at = datetime.now(UTC)
            s.flush()
            return _row_to_task(row)


class ApprovalStore:
    def create(self, payload: ApprovalRequest) -> ApprovalRequest:
        with session_scope() as s:
            row = ApprovalRow(
                id=payload.id,
                task_id=payload.task_id,
                agent_id=payload.agent_id,
                action=payload.action,
                description=payload.description,
                params=payload.params,
                risk_level=payload.risk_level,
                expected_impact=payload.expected_impact,
                status=payload.status,
                reviewer_note=payload.reviewer_note,
                created_at=payload.created_at,
                resolved_at=payload.resolved_at,
            )
            s.merge(row)
            s.flush()
            return payload

    def all(self) -> list[ApprovalRequest]:
        with session_scope() as s:
            rows = s.query(ApprovalRow).order_by(ApprovalRow.created_at.desc()).all()
            return [_row_to_approval(r) for r in rows]

    def resolve(self, approval_id: str, *, status: str, note: str | None) -> ApprovalRequest | None:
        with session_scope() as s:
            row = s.get(ApprovalRow, approval_id)
            if not row:
                return None
            row.status = status
            row.reviewer_note = note
            row.resolved_at = datetime.now(UTC)
            s.flush()
            return _row_to_approval(row)

    def update_impact(self, approval_id: str, impact: str) -> ApprovalRequest | None:
        with session_scope() as s:
            row = s.get(ApprovalRow, approval_id)
            if not row:
                return None
            row.expected_impact = impact
            s.flush()
            return _row_to_approval(row)

    def get(self, approval_id: str) -> ApprovalRequest | None:
        with session_scope() as s:
            row = s.get(ApprovalRow, approval_id)
            return _row_to_approval(row) if row else None


_tasks: TaskStore | None = None
_approvals: ApprovalStore | None = None


def get_task_store() -> TaskStore:
    global _tasks
    if _tasks is None:
        _tasks = TaskStore()
    return _tasks


def get_approval_store() -> ApprovalStore:
    global _approvals
    if _approvals is None:
        _approvals = ApprovalStore()
    return _approvals
