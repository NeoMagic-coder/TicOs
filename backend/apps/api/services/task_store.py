"""SQLAlchemy-backed task & approval stores.

Public API matches the previous in-memory implementation so routes don't need
to change. Tasks and approvals persist to the database configured in
``apps.api.core.config.Settings.database_url`` (SQLite by default).
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime

from apps.api.core.db import session_scope
from apps.api.core.db.models import AgentStatRow, ApprovalRow, TaskRow
from apps.api.models.schemas import AgentStats, ApprovalRequest, Task, TaskCreate, TaskStatus


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


class AgentStatStore:
    """Upserts per-agent activity counters after each orchestration wave."""

    def record_completion(
        self,
        agent_id: str,
        *,
        tools_used: int,
        confidence: float,
        duration_ms: float,
        success: bool,
        cost_usd: float = 0.0,
    ) -> None:
        today = datetime.now(UTC).strftime("%Y-%m-%d")
        now = datetime.now(UTC)
        with session_scope() as s:
            row = s.get(AgentStatRow, agent_id)
            if row is None:
                row = AgentStatRow(
                    agent_id=agent_id,
                    date=today,
                    tasks_completed_today=1,
                    tasks_total=1,
                    tools_used_today=tools_used,
                    avg_confidence=confidence,
                    success_rate=1.0 if success else 0.0,
                    avg_duration_ms=duration_ms,
                    total_cost_usd=cost_usd,
                    last_task_at=now,
                )
                s.add(row)
            else:
                if row.date != today:
                    row.date = today
                    row.tasks_completed_today = 0
                    row.tools_used_today = 0
                row.tasks_completed_today += 1
                row.tasks_total += 1
                row.tools_used_today += tools_used
                row.total_cost_usd += cost_usd
                row.last_task_at = now
                # Exponential moving average for confidence and duration
                alpha = 0.3
                row.avg_confidence = alpha * confidence + (1 - alpha) * row.avg_confidence
                row.avg_duration_ms = alpha * duration_ms + (1 - alpha) * row.avg_duration_ms
                # Success rate: running mean
                total = row.tasks_total
                prev_rate = row.success_rate
                row.success_rate = prev_rate + (int(success) - prev_rate) / total
            s.flush()

    def get_stats(self, agent_id: str) -> AgentStats:
        today = datetime.now(UTC).strftime("%Y-%m-%d")
        with session_scope() as s:
            row = s.get(AgentStatRow, agent_id)
            if row is None or row.date != today:
                today_tasks = 0
                today_tools = 0
            else:
                today_tasks = row.tasks_completed_today
                today_tools = row.tools_used_today
            return AgentStats(
                tasks_completed_today=today_tasks,
                tasks_total=row.tasks_total if row else 0,
                tools_used_today=today_tools,
                avg_confidence=round(row.avg_confidence, 3) if row else 0.0,
                success_rate=round(row.success_rate, 3) if row else 0.0,
                avg_duration_ms=round(row.avg_duration_ms, 1) if row else 0.0,
                last_task_at=row.last_task_at if row else None,
            )

    def all_stats(self) -> dict[str, AgentStats]:
        today = datetime.now(UTC).strftime("%Y-%m-%d")
        with session_scope() as s:
            rows = s.query(AgentStatRow).all()
            return {
                r.agent_id: AgentStats(
                    tasks_completed_today=r.tasks_completed_today if r.date == today else 0,
                    tasks_total=r.tasks_total,
                    tools_used_today=r.tools_used_today if r.date == today else 0,
                    avg_confidence=round(r.avg_confidence, 3),
                    success_rate=round(r.success_rate, 3),
                    avg_duration_ms=round(r.avg_duration_ms, 1),
                    last_task_at=r.last_task_at,
                )
                for r in rows
            }


_tasks: TaskStore | None = None
_approvals: ApprovalStore | None = None
_agent_stats: AgentStatStore | None = None


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


def get_agent_stat_store() -> AgentStatStore:
    global _agent_stats
    if _agent_stats is None:
        _agent_stats = AgentStatStore()
    return _agent_stats
