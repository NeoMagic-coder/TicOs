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
