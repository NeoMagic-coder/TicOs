"""SQLAlchemy engine + session factory.

SQLite is the default; switch to Postgres by overriding DATABASE_URL.
``init_db`` is idempotent — safe to call on every boot.
"""
from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger

log = get_logger(__name__)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""


_settings = get_settings()
_url = _settings.database_url

# SQLite needs check_same_thread=False for FastAPI's thread pool; Postgres ignores it.
_connect_args: dict[str, object] = {}
if _url.startswith("sqlite"):
    _connect_args["check_same_thread"] = False
    # Make sure the parent directory exists (sqlite won't auto-create dirs).
    db_path = _url.replace("sqlite:///", "", 1)
    if db_path and not db_path.startswith(":memory:"):
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(_url, connect_args=_connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


def init_db() -> None:
    """Create all tables. Idempotent.

    On Postgres, also ensures the ``pgvector`` extension exists so the
    :class:`apps.api.core.db.models.MemoryRow.embedding` column can use the
    ``Vector`` type for cosine-distance indexed search.
    """
    # Import models so they register with Base.metadata before create_all.
    from apps.api.core.db import models  # noqa: F401
    from apps.api.core.db import tic_models  # noqa: F401

    if engine.dialect.name == "postgresql":
        try:
            with engine.begin() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            log.info("db.pgvector.enabled")
        except Exception as exc:  # extension may be missing; degrade to JSON column
            log.warning("db.pgvector.unavailable", error=str(exc))

    Base.metadata.create_all(bind=engine)

    # Lightweight schema evolution for SQLite dev DBs: ``create_all`` only
    # creates *missing tables*, not new columns on existing ones. When we add
    # a column to an ORM model, the existing app.db still has the old shape
    # until we either drop it or ALTER it. We only do this for SQLite to keep
    # things contained — production Postgres should use real migrations.
    if engine.dialect.name == "sqlite":
        _ensure_sqlite_columns()

    log.info("db.init", url=_url, tables=len(Base.metadata.tables))


def _ensure_sqlite_columns() -> None:
    """Add missing columns to existing SQLite tables (dev-only nicety).

    Each entry is ``(table, column, ddl_type)``. ``ALTER TABLE ... ADD COLUMN``
    is idempotent against ``PRAGMA table_info`` checks.
    """
    expected: list[tuple[str, str, str]] = [
        ("tasks", "goal_id", "VARCHAR(64)"),
        ("tic_products", "workspace_product_name", "VARCHAR(200)"),
    ]
    with engine.begin() as conn:
        for table, column, ddl in expected:
            # Skip if table itself doesn't exist yet (create_all already ran,
            # so a missing table means it's not a registered model).
            exists = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name=:t"),
                {"t": table},
            ).first()
            if not exists:
                continue
            cols = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
            if column in cols:
                continue
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
            log.info("db.sqlite.column_added", table=table, column=column)


@contextmanager
def session_scope() -> Iterator[Session]:
    """Transactional unit-of-work scope. Commits on exit; rolls back on error."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
