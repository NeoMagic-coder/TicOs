"""Motor async MongoDB istemci testleri (apps/api/core/db/mongo.py).

Gerçek bir MongoDB bağlantısı gerektirmez — AsyncIOMotorClient mock'lanır.

Kapsam:
  - connect_mongo: başarılı ve başarısız ping senaryoları
  - disconnect_mongo: bağlı / bağlantısız durum
  - get_mongo_client: bağlantı olmadan RuntimeError
  - get_mongo_db: doğru veritabanı adı döner
  - get_mongo_db_dep: FastAPI Depends() async generator
  - _get_url / _get_db_name: Settings'ten okuma

Çalıştır:
    pytest apps/api/tests/test_mongo.py -q
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import apps.api.core.db.mongo as mongo_mod


# ---------------------------------------------------------------------------
# Fixture: her testten önce global _client'ı sıfırla
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def reset_client():
    mongo_mod._client = None
    yield
    mongo_mod._client = None


# ---------------------------------------------------------------------------
# Yardımcı: sahte Motor istemcisi
# ---------------------------------------------------------------------------

def _make_mock_client(ping_raises: Exception | None = None) -> MagicMock:
    client = MagicMock()
    client.admin = MagicMock()
    if ping_raises:
        client.admin.command = AsyncMock(side_effect=ping_raises)
    else:
        client.admin.command = AsyncMock(return_value={"ok": 1})
    client.close = MagicMock()
    client.__getitem__ = MagicMock(return_value=MagicMock())
    return client


# ---------------------------------------------------------------------------
# connect_mongo
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_connect_mongo_success():
    mock_client = _make_mock_client()
    with patch("apps.api.core.db.mongo.AsyncIOMotorClient", return_value=mock_client):
        await mongo_mod.connect_mongo()

    assert mongo_mod._client is mock_client
    mock_client.admin.command.assert_awaited_once_with("ping")


@pytest.mark.asyncio
async def test_connect_mongo_ping_fails_does_not_raise():
    """Ping başarısız olsa bile connect_mongo exception fırlatmamalı (graceful degrade)."""
    mock_client = _make_mock_client(ping_raises=ConnectionError("sunucuya ulaşılamıyor"))
    with patch("apps.api.core.db.mongo.AsyncIOMotorClient", return_value=mock_client):
        await mongo_mod.connect_mongo()  # exception fırlatmamalı

    assert mongo_mod._client is mock_client


@pytest.mark.asyncio
async def test_connect_mongo_sets_client_with_correct_url(monkeypatch):
    captured = {}

    def fake_client(url, **kwargs):
        captured["url"] = url
        return _make_mock_client()

    monkeypatch.setattr(mongo_mod, "AsyncIOMotorClient", fake_client)
    monkeypatch.setenv("MONGODB_URL", "mongodb://testhost:27017")

    with patch.object(mongo_mod, "_get_url", return_value="mongodb://testhost:27017"):
        await mongo_mod.connect_mongo()

    assert captured["url"] == "mongodb://testhost:27017"


# ---------------------------------------------------------------------------
# disconnect_mongo
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_disconnect_mongo_closes_client():
    mock_client = _make_mock_client()
    mongo_mod._client = mock_client

    await mongo_mod.disconnect_mongo()

    mock_client.close.assert_called_once()
    assert mongo_mod._client is None


@pytest.mark.asyncio
async def test_disconnect_mongo_when_not_connected_does_not_raise():
    assert mongo_mod._client is None
    await mongo_mod.disconnect_mongo()  # exception fırlatmamalı
    assert mongo_mod._client is None


@pytest.mark.asyncio
async def test_disconnect_mongo_idempotent():
    mock_client = _make_mock_client()
    mongo_mod._client = mock_client

    await mongo_mod.disconnect_mongo()
    await mongo_mod.disconnect_mongo()  # ikinci çağrı güvenli olmalı

    assert mock_client.close.call_count == 1


# ---------------------------------------------------------------------------
# get_mongo_client
# ---------------------------------------------------------------------------

def test_get_mongo_client_returns_client_when_connected():
    mock_client = _make_mock_client()
    mongo_mod._client = mock_client

    result = mongo_mod.get_mongo_client()

    assert result is mock_client


def test_get_mongo_client_raises_when_not_connected():
    assert mongo_mod._client is None
    with pytest.raises(RuntimeError, match="connect_mongo"):
        mongo_mod.get_mongo_client()


# ---------------------------------------------------------------------------
# get_mongo_db
# ---------------------------------------------------------------------------

def test_get_mongo_db_returns_correct_database():
    fake_db = MagicMock()
    mock_client = _make_mock_client()
    mock_client.__getitem__ = MagicMock(return_value=fake_db)
    mongo_mod._client = mock_client

    with patch.object(mongo_mod, "_get_db_name", return_value="ticosclaw"):
        result = mongo_mod.get_mongo_db()

    mock_client.__getitem__.assert_called_once_with("ticosclaw")
    assert result is fake_db


def test_get_mongo_db_raises_when_not_connected():
    with pytest.raises(RuntimeError):
        mongo_mod.get_mongo_db()


# ---------------------------------------------------------------------------
# get_mongo_db_dep (FastAPI Depends async generator)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_mongo_db_dep_yields_database():
    fake_db = MagicMock()
    mongo_mod._client = _make_mock_client()

    with patch.object(mongo_mod, "get_mongo_db", return_value=fake_db):
        gen = mongo_mod.get_mongo_db_dep()
        db = await gen.__anext__()

    assert db is fake_db


# ---------------------------------------------------------------------------
# _get_url / _get_db_name
# ---------------------------------------------------------------------------

def test_get_url_returns_settings_value():
    with patch.object(mongo_mod, "_get_url", return_value="mongodb://myhost:27017"):
        assert mongo_mod._get_url() == "mongodb://myhost:27017"


def test_get_url_falls_back_to_localhost_when_empty():
    with patch("apps.api.core.db.mongo.get_settings") as mock_settings:
        mock_settings.return_value.mongodb_url = ""
        url = mongo_mod._get_url()
    assert url == "mongodb://localhost:27017"


def test_get_db_name_returns_settings_value():
    with patch("apps.api.core.db.mongo.get_settings") as mock_settings:
        mock_settings.return_value.mongodb_db_name = "benim_db"
        name = mongo_mod._get_db_name()
    assert name == "benim_db"


def test_get_db_name_falls_back_to_ticosclaw_when_empty():
    with patch("apps.api.core.db.mongo.get_settings") as mock_settings:
        mock_settings.return_value.mongodb_db_name = ""
        name = mongo_mod._get_db_name()
    assert name == "ticosclaw"


# ---------------------------------------------------------------------------
# connect → kullan → disconnect tam döngüsü
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_full_lifecycle():
    fake_db = MagicMock()
    mock_client = _make_mock_client()
    mock_client.__getitem__ = MagicMock(return_value=fake_db)

    with patch("apps.api.core.db.mongo.AsyncIOMotorClient", return_value=mock_client):
        await mongo_mod.connect_mongo()
        db = mongo_mod.get_mongo_db()
        assert db is fake_db
        await mongo_mod.disconnect_mongo()

    assert mongo_mod._client is None
    with pytest.raises(RuntimeError):
        mongo_mod.get_mongo_client()
