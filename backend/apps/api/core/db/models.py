"""ORM models mirroring ``apps.api.models.schemas``.

We persist tasks and approvals here. Pydantic schemas stay the wire format;
these rows convert to/from them via the row_to_* helpers.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from apps.api.core.config import get_settings
from apps.api.core.db.engine import Base, engine

_EMBEDDING_DIM = get_settings().embedding_dim

# Use pgvector's Vector type on Postgres (enables `<=>` cosine distance and
# IVFFlat / HNSW indexes); fall back to JSON elsewhere so SQLite-based dev
# and the test suite keep working unchanged.
try:
    from pgvector.sqlalchemy import Vector  # type: ignore[import-not-found]
    _HAS_PGVECTOR = True
except ImportError:  # pgvector is an optional install for sqlite-only setups
    Vector = None  # type: ignore[assignment]
    _HAS_PGVECTOR = False

if _HAS_PGVECTOR and engine.dialect.name == "postgresql":
    _EmbeddingColumn = Vector(_EMBEDDING_DIM)  # type: ignore[misc]
else:
    _EmbeddingColumn = JSON


def _utcnow() -> datetime:
    return datetime.now(UTC)


class TaskRow(Base):
    __tablename__ = "tasks"

    task_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    parent_task_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    title: Mapped[str] = mapped_column(String(512))
    description: Mapped[str] = mapped_column(String, default="")
    goal: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String(32), default="created", index=True)
    priority: Mapped[str] = mapped_column(String(16), default="medium")
    assigned_agent_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    context: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    constraints: Mapped[list[str]] = mapped_column(JSON, default=list)
    required_capabilities: Mapped[list[str]] = mapped_column(JSON, default=list)
    max_iterations: Mapped[int] = mapped_column(Integer, default=5)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    approval_required: Mapped[bool] = mapped_column(default=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    iterations_used: Mapped[int] = mapped_column(Integer, default=0)
    sub_tasks: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Serialized AgentOutput, kept as JSON to avoid schema churn.
    result: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)


class ApprovalRow(Base):
    __tablename__ = "approvals"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    task_id: Mapped[str] = mapped_column(String(64), ForeignKey("tasks.task_id", ondelete="CASCADE"), index=True)
    agent_id: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(512))
    description: Mapped[str] = mapped_column(String, default="")
    params: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    risk_level: Mapped[str] = mapped_column(String(16))
    expected_impact: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)
    reviewer_note: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    task: Mapped[TaskRow] = relationship(backref="approvals")


class AgentStatRow(Base):
    """Per-agent activity counters. Upserted after each completed orchestration wave.
    One row per agent_id; ``date`` tracks the current UTC date so daily counters
    can be reset at midnight without losing ``tasks_total``."""

    __tablename__ = "agent_stats"

    agent_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    date: Mapped[str] = mapped_column(String(10), default="")       # "YYYY-MM-DD"
    tasks_completed_today: Mapped[int] = mapped_column(Integer, default=0)
    tasks_total: Mapped[int] = mapped_column(Integer, default=0)
    tools_used_today: Mapped[int] = mapped_column(Integer, default=0)
    avg_confidence: Mapped[float] = mapped_column(Float, default=0.0)
    success_rate: Mapped[float] = mapped_column(Float, default=0.0)
    avg_duration_ms: Mapped[float] = mapped_column(Float, default=0.0)
    total_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    last_task_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ScheduledJobRow(Base):
    """User-defined scheduled automation jobs.

    Persisted so jobs survive server restarts. On boot, all enabled rows are
    loaded and registered with APScheduler. ``schedule_expr`` may be a
    standard cron string (``"0 9 * * 1"``) or a human-readable description
    that the LLM has already converted to a cron string.
    """

    __tablename__ = "scheduled_jobs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)   # "job_<uuid>"
    name: Mapped[str] = mapped_column(String(256))
    prompt: Mapped[str] = mapped_column(String)                      # Hermes prompt
    schedule_expr: Mapped[str] = mapped_column(String(128))          # cron expression
    agent_hint: Mapped[str | None] = mapped_column(String(64), nullable=True)
    delivery_platform: Mapped[str] = mapped_column(String(32), default="web")
    delivery_target: Mapped[str] = mapped_column(String(256), default="")
    enabled: Mapped[bool] = mapped_column(default=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_status: Mapped[str] = mapped_column(String(16), default="never")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class SkillRow(Base):
    """Learned skill extracted from high-confidence task completions.

    ``tool_sequence`` is a JSON-encoded ordered list of tool_ids that make up
    the skill. ``trigger_pattern`` is a JSON-encoded list of keyword hints
    used to surface the skill for future matching.
    """

    __tablename__ = "skills"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # "skill_<hash>"
    name: Mapped[str] = mapped_column(String(256))
    description: Mapped[str] = mapped_column(String, default="")
    trigger_pattern: Mapped[str] = mapped_column(String, default="[]")   # JSON list[str]
    tool_sequence: Mapped[str] = mapped_column(String, default="[]")     # JSON list[str]
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    success_rate: Mapped[float] = mapped_column(Float, default=1.0)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_task_id: Mapped[str] = mapped_column(String(64), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class SubagentRow(Base):
    """Audit record linking a parent task to a spawned sub-agent task.

    Created when an agent calls the ``spawn_subagent`` tool. The parent and
    child share the same DB but have completely independent ExecutionContexts.
    """

    __tablename__ = "subagents"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)       # "sub_<uuid>"
    parent_task_id: Mapped[str] = mapped_column(String(64), index=True)
    child_task_id: Mapped[str] = mapped_column(String(64), index=True)
    agent_id: Mapped[str] = mapped_column(String(64))
    message: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String(16), default="running")   # running | completed | failed
    budget_usd: Mapped[float] = mapped_column(Float, default=0.0)
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    summary: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class GatewaySessionRow(Base):
    """Cross-platform conversation session for the multi-platform gateway.

    Each (platform, platform_chat_id) pair has at most one active session.
    History is capped at 50 turns; older turns are rolled into a session
    summary stored in MemoryRow (kind='session_summary').
    """

    __tablename__ = "gateway_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # "gw_<uuid>"
    platform: Mapped[str] = mapped_column(String(32), index=True)   # "telegram" | "discord" | "slack" | "whatsapp" | "cli"
    platform_user_id: Mapped[str] = mapped_column(String(256))
    platform_chat_id: Mapped[str] = mapped_column(String(256), index=True)
    history: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    product_context: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    last_active_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class TrajectoryRow(Base):
    """Full tool-call trajectory for a completed Hermes task.

    Steps follow the Anthropic tool-use message format so they can be used
    directly for fine-tuning. Compressed steps strip redundant/retried turns.
    ``quality_score`` is a critic-based 0–1 rating of the final output.
    """

    __tablename__ = "trajectories"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)         # "traj_<uuid>"
    task_id: Mapped[str] = mapped_column(String(64), index=True)
    steps: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    compressed_steps: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    quality_score: Mapped[float] = mapped_column(Float, default=0.0)
    exported_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)


class MemoryRow(Base):
    """Vector-backed memory document.

    Stores user messages, agent outputs, and arbitrary docs alongside their
    embeddings. On Postgres the ``embedding`` column is a pgvector ``Vector``;
    on SQLite it's a plain JSON list and cosine similarity is computed in
    Python. ``kind`` separates lookup scopes ("user_message", "agent_output",
    "tool_result", "doc").
    """

    __tablename__ = "memories"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    kind: Mapped[str] = mapped_column(String(32), default="doc", index=True)
    agent_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    task_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    text: Mapped[str] = mapped_column(String, default="")
    meta: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    embedding: Mapped[list[float]] = mapped_column(_EmbeddingColumn)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, index=True)
