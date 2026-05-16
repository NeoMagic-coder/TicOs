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

    if engine.dialect.name == "postgresql":
        try:
            with engine.begin() as conn:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            log.info("db.pgvector.enabled")
        except Exception as exc:  # extension may be missing; degrade to JSON column
            log.warning("db.pgvector.unavailable", error=str(exc))

    Base.metadata.create_all(bind=engine)
    log.info("db.init", url=_url, tables=len(Base.metadata.tables))


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
