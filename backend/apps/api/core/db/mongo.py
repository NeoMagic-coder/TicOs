"""Motor (async) MongoDB client.

Bağlantı URL'i ``MONGODB_URL`` env değişkeninden okunur.
Yoksa ``mongodb://localhost:27017`` varsayılanı kullanılır.

Kullanım:
    from apps.api.core.db.mongo import get_mongo_db

    async def handler(db=Depends(get_mongo_db)):
        doc = await db["collection"].find_one({})
"""
from __future__ import annotations

from typing import AsyncIterator

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger

log = get_logger(__name__)

_client: AsyncIOMotorClient | None = None


def _get_url() -> str:
    settings = get_settings()
    return getattr(settings, "mongodb_url", "") or "mongodb://localhost:27017"


def _get_db_name() -> str:
    settings = get_settings()
    return getattr(settings, "mongodb_db_name", "") or "ticosclaw"


async def connect_mongo() -> None:
    global _client
    url = _get_url()
    _client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=5_000)
    try:
        await _client.admin.command("ping")
        log.info("mongo.connected", url=url, db=_get_db_name())
    except Exception as exc:
        log.warning("mongo.unavailable", error=str(exc))


async def disconnect_mongo() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
        log.info("mongo.disconnected")


def get_mongo_client() -> AsyncIOMotorClient:
    if _client is None:
        raise RuntimeError("MongoDB bağlantısı başlatılmadı. connect_mongo() çağrıldı mı?")
    return _client


def get_mongo_db() -> AsyncIOMotorDatabase:
    return get_mongo_client()[_get_db_name()]


async def get_mongo_db_dep() -> AsyncIterator[AsyncIOMotorDatabase]:
    """FastAPI Depends() ile kullanım için async generator."""
    yield get_mongo_db()
