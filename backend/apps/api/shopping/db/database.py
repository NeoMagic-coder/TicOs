"""Async veritabani motoru ve oturum fabrikasi."""

from __future__ import annotations

from collections.abc import AsyncIterator
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from apps.api.shopping.config import get_settings
from apps.api.shopping.db.models import Base

_settings = get_settings()

# SQLite + asyncio'da havuz paylasimi sorun cikarir; NullPool guvenli secim
_engine_kwargs = {"poolclass": NullPool} if _settings.database_url.startswith("sqlite") else {}

engine = create_async_engine(_settings.database_url, **_engine_kwargs)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


def _ensure_sqlite_dir(url: str) -> None:
    if not url.startswith("sqlite") or ":memory:" in url:
        return
    path = url.split("///", 1)[-1]
    parent = Path(path).parent
    if str(parent) and str(parent) != ".":
        parent.mkdir(parents=True, exist_ok=True)


async def init_db() -> None:
    _ensure_sqlite_dir(_settings.database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session

