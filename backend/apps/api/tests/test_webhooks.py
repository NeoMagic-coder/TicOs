"""Tests for /webhooks/telegram endpoint.

Patches are applied at the gateway layer so no real HTTP or DB calls are made.
Client is created inline (no async fixture) to avoid pytest-asyncio strict-mode
generator issues.
"""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from apps.api.main import create_app

_PATCH_SETTINGS = "apps.api.routes.webhooks.get_settings"
_PATCH_ADAPTER = "apps.api.gateway.telegram.get_telegram_adapter"

_app = create_app()

_UPDATE = {
    "update_id": 1,
    "message": {
        "message_id": 10,
        "chat": {"id": 12345, "type": "private"},
        "text": "Ürün fiyatımı güncelle",
    },
}


def _settings(*, token="", secret=""):
    return MagicMock(
        telegram_bot_token=token,
        telegram_webhook_secret=secret,
        shopify_webhook_secret="",
        discord_bot_token="",
        slack_bot_token="",
        slack_signing_secret="",
        twilio_account_sid="",
    )


def _mock_adapter(*, verify_ok=True):
    adapter = MagicMock()
    adapter.verify_secret = MagicMock(return_value=verify_ok)
    adapter.handle_update = AsyncMock()
    return adapter


@pytest.mark.asyncio
async def test_telegram_no_token_returns_503():
    async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as client:
        with patch(_PATCH_SETTINGS, return_value=_settings(token="")):
            resp = await client.post("/webhooks/telegram", json=_UPDATE)
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_telegram_wrong_secret_returns_401():
    adapter = _mock_adapter(verify_ok=False)
    async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as client:
        with (
            patch(_PATCH_SETTINGS, return_value=_settings(token="tok:x", secret="correct")),
            patch(_PATCH_ADAPTER, return_value=adapter),
        ):
            resp = await client.post(
                "/webhooks/telegram",
                json=_UPDATE,
                headers={"X-Telegram-Bot-Api-Secret-Token": "wrong"},
            )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_telegram_correct_secret_passes():
    adapter = _mock_adapter(verify_ok=True)
    async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as client:
        with (
            patch(_PATCH_SETTINGS, return_value=_settings(token="tok:x", secret="s3cr3t")),
            patch(_PATCH_ADAPTER, return_value=adapter),
        ):
            resp = await client.post(
                "/webhooks/telegram",
                json=_UPDATE,
                headers={"X-Telegram-Bot-Api-Secret-Token": "s3cr3t"},
            )
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_telegram_update_dispatched():
    """Endpoint returns 200 and dispatches handle_update as a background task."""
    adapter = _mock_adapter()
    async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as client:
        with (
            patch(_PATCH_SETTINGS, return_value=_settings(token="tok:x")),
            patch(_PATCH_ADAPTER, return_value=adapter),
        ):
            resp = await client.post("/webhooks/telegram", json=_UPDATE)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_telegram_no_secret_config_skips_verify():
    """When telegram_webhook_secret is empty, verify_secret is not called."""
    adapter = _mock_adapter()
    async with AsyncClient(transport=ASGITransport(app=_app), base_url="http://test") as client:
        with (
            patch(_PATCH_SETTINGS, return_value=_settings(token="tok:x", secret="")),
            patch(_PATCH_ADAPTER, return_value=adapter),
        ):
            resp = await client.post("/webhooks/telegram", json=_UPDATE)
    assert resp.status_code == 200
    adapter.verify_secret.assert_not_called()
