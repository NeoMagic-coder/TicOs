"""SQLAlchemy-backed persistence layer.

Exports:
- ``engine`` / ``SessionLocal`` — low-level access.
- ``Base`` — declarative base for ORM models.
- ``init_db()`` — idempotent schema creation; called from FastAPI lifespan.
- ``session_scope()`` — context manager for unit-of-work usage.
"""
from __future__ import annotations

from apps.api.core.db.engine import Base, SessionLocal, engine, init_db, session_scope

__all__ = ["Base", "SessionLocal", "engine", "init_db", "session_scope"]
