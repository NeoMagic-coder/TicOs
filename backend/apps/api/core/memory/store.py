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


async def search_sessions_fts(
    *,
    query: str,
    k: int = 10,
    kind: str | None = None,
) -> list[dict[str, Any]]:
    """Full-text search over memory rows.

    On SQLite uses the FTS5 virtual table (created on first call).
    On PostgreSQL uses ``to_tsvector`` with the 'turkish' text search config.
    Returns the same shape as ``search_memory`` for drop-in use.
    """
    query = (query or "").strip()
    if not query:
        return []
    try:
        if _USE_PGVECTOR:
            return _fts_pg(query, k=k, kind=kind)
        return _fts_sqlite(query, k=k, kind=kind)
    except Exception as exc:
        log.warning("memory.fts_failed", error=str(exc)[:200])
        return []


_fts_ready = False


def _ensure_fts_table() -> None:
    with session_scope() as db:
        db.execute(sql_text(
            "CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts "
            "USING fts5(text, content='memories', content_rowid='rowid')"
        ))
        db.execute(sql_text(
            "INSERT OR IGNORE INTO memory_fts(rowid, text) "
            "SELECT rowid, text FROM memories"
        ))


def _fts_sqlite(query: str, *, k: int, kind: str | None) -> list[dict[str, Any]]:
    global _fts_ready  # noqa: PLW0603
    if not _fts_ready:
        _ensure_fts_table()
        _fts_ready = True

    safe_query = query.replace('"', '""')
    kind_join = "AND m.kind = :kind " if kind else ""
    sql = sql_text(
        "SELECT m.id, m.kind, m.agent_id, m.task_id, m.text, m.metadata, "
        "fts.rank AS score "
        "FROM memory_fts fts "
        "JOIN memories m ON fts.rowid = m.rowid "
        f"WHERE fts.text MATCH :q {kind_join}"
        "ORDER BY fts.rank LIMIT :k"
    )
    params: dict[str, Any] = {"q": f'"{safe_query}"', "k": k}
    if kind:
        params["kind"] = kind
    with session_scope() as db:
        rows = db.execute(sql, params).mappings().all()
    return [dict(r) for r in rows]


def _fts_pg(query: str, *, k: int, kind: str | None) -> list[dict[str, Any]]:
    kind_clause = "AND kind = :kind " if kind else ""
    sql = sql_text(
        "SELECT id, kind, agent_id, task_id, text, metadata, "
        "ts_rank(to_tsvector('turkish', text), plainto_tsquery('turkish', :q)) AS score "
        "FROM memories "
        f"WHERE to_tsvector('turkish', text) @@ plainto_tsquery('turkish', :q) {kind_clause}"
        "ORDER BY score DESC LIMIT :k"
    )
    params: dict[str, Any] = {"q": query, "k": k}
    if kind:
        params["kind"] = kind
    with session_scope() as db:
        rows = db.execute(sql, params).mappings().all()
    return [dict(r) for r in rows]


async def store_memory(
    *,
    product_id: str,
    kind: str = "doc",
    text: str,
    agent_id: str | None = None,
    task_id: str | None = None,
    meta: dict[str, Any] | None = None,
) -> str | None:
    """Persist a product-scoped memory entry. Returns the row id on success.

    ``product_id`` is stored inside ``metadata`` so it can be used as a
    filter in :func:`retrieve_memory`.  The function never raises.
    """
    metadata = {"product_id": product_id, **(meta or {})}
    return await add_memory(
        text=text,
        kind=kind,
        agent_id=agent_id,
        task_id=task_id,
        metadata=metadata,
    )


async def retrieve_memory(
    *,
    product_id: str,
    query: str,
    k: int = 5,
    kind: str | None = None,
) -> list[dict[str, Any]]:
    """Return the top-``k`` memories scoped to ``product_id``.

    Fetches a wider candidate set (k*4) then filters and re-ranks by
    ``product_id`` match so callers always get product-relevant results
    even on sparse corpora.
    """
    candidates = await search_memory(query=query, k=k * 4, kind=kind)
    filtered = [
        m for m in candidates
        if m.get("metadata", {}).get("product_id") == product_id
    ]
    return filtered[:k]
