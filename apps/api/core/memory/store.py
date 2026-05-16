"""Vector memory store. Writes embeddings and runs cosine-similarity search.

On Postgres with pgvector installed, search uses the native ``<=>`` operator
(cosine distance) so large memories scale. Elsewhere (SQLite dev/tests) the
function pulls candidate rows and ranks them in Python.
"""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select, text as sql_text

from apps.api.core.db.engine import engine, session_scope
from apps.api.core.db.models import MemoryRow
from apps.api.core.logging import get_logger
from apps.api.core.memory.embedding import cosine_similarity, embed_text

log = get_logger(__name__)

_USE_PGVECTOR = engine.dialect.name == "postgresql"


async def add_memory(
    *,
    text: str,
    kind: str = "doc",
    agent_id: str | None = None,
    task_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> str | None:
    """Embed ``text`` and persist a MemoryRow. Returns the row id on success.

    Never raises — failures are swallowed and logged so memory write errors
    can't take down the orchestration path.
    """
    text = (text or "").strip()
    if not text:
        return None
    try:
        vec = await embed_text(text)
    except Exception as exc:
        log.warning("memory.embed_failed", error=str(exc)[:200])
        return None

    row_id = f"mem_{uuid.uuid4().hex[:12]}"
    try:
        with session_scope() as session:
            session.add(MemoryRow(
                id=row_id,
                kind=kind,
                agent_id=agent_id,
                task_id=task_id,
                text=text[:10_000],
                meta=metadata or {},
                embedding=vec,
                created_at=datetime.now(UTC),
            ))
        return row_id
    except Exception as exc:
        log.warning("memory.write_failed", error=str(exc)[:200])
        return None


async def search_memory(
    *,
    query: str,
    k: int = 5,
    kind: str | None = None,
) -> list[dict[str, Any]]:
    """Return the top-``k`` memories by cosine similarity to ``query``.

    Each result is a dict with id, kind, agent_id, task_id, text, metadata,
    score (cosine similarity in [-1, 1], higher = closer).
    """
    query = (query or "").strip()
    if not query:
        return []
    try:
        qvec = await embed_text(query)
    except Exception as exc:
        log.warning("memory.search.embed_failed", error=str(exc)[:200])
        return []

    if _USE_PGVECTOR:
        return _search_pg(qvec, k=k, kind=kind)
    return _search_python(qvec, k=k, kind=kind)


def _search_pg(qvec: list[float], *, k: int, kind: str | None) -> list[dict[str, Any]]:
    where = "WHERE kind = :kind " if kind else ""
    sql = sql_text(
        "SELECT id, kind, agent_id, task_id, text, metadata, "
        "1 - (embedding <=> CAST(:q AS vector)) AS score "
        f"FROM memories {where}"
        "ORDER BY embedding <=> CAST(:q AS vector) ASC LIMIT :k"
    )
    params: dict[str, Any] = {"q": qvec, "k": k}
    if kind:
        params["kind"] = kind
    try:
        with session_scope() as session:
            rows = session.execute(sql, params).mappings().all()
        return [dict(r) for r in rows]
    except Exception as exc:
        log.warning("memory.search.pg_failed", error=str(exc)[:200])
        return _search_python(qvec, k=k, kind=kind)


def _search_python(qvec: list[float], *, k: int, kind: str | None) -> list[dict[str, Any]]:
    stmt = select(MemoryRow).order_by(MemoryRow.created_at.desc()).limit(2000)
    if kind:
        stmt = stmt.where(MemoryRow.kind == kind)
    with session_scope() as session:
        rows = session.execute(stmt).scalars().all()
        scored = [
            {
                "id": r.id,
                "kind": r.kind,
                "agent_id": r.agent_id,
                "task_id": r.task_id,
                "text": r.text,
                "metadata": r.meta,
                "score": cosine_similarity(qvec, r.embedding or []),
            }
            for r in rows
        ]
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:k]
