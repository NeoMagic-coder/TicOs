"""Telegram Bot gateway adapter (webhook mode)."""
from __future__ import annotations

import hashlib
import hmac
from typing import Any

import httpx

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger
from apps.api.gateway.base import BaseGatewayAdapter

log = get_logger(__name__)

_API_BASE = "https://api.telegram.org/bot{token}"


class TelegramAdapter(BaseGatewayAdapter):
    platform = "telegram"

    def __init__(self) -> None:
        self._settings = get_settings()
        self._base = _API_BASE.format(token=self._settings.telegram_bot_token)

    async def start(self) -> None:
        if not self._settings.telegram_bot_token:
            log.info("gateway.telegram.disabled", reason="no bot token")
            return
        log.info("gateway.telegram.ready", mode="webhook")

    async def stop(self) -> None:
        pass

    async def send_message(self, chat_id: str, text: str) -> None:
        if not self._settings.telegram_bot_token:
            return
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{self._base}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"},
            )

    def verify_secret(self, header_token: str) -> bool:
        expected = self._settings.telegram_webhook_secret
        if not expected:
            return True
        return hmac.compare_digest(expected, header_token)

    async def handle_update(self, update: dict[str, Any]) -> None:
        """Called by the webhook route with a raw Telegram update payload."""
        msg = update.get("message") or update.get("edited_message")
        if not msg:
            return

        chat_id = str(msg["chat"]["id"])
        user_id = str(msg["from"]["id"])
        text: str | None = msg.get("text")
        voice: dict | None = msg.get("voice")

        if voice:
            file_id = voice["file_id"]
            voice_url = await self._get_file_url(file_id)
            await self.handle_incoming(user_id, chat_id, text or "", voice_url=voice_url)
        elif text:
            await self.handle_incoming(user_id, chat_id, text)

    async def _get_file_url(self, file_id: str) -> str:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{self._base}/getFile", params={"file_id": file_id})
            r.raise_for_status()
            path = r.json()["result"]["file_path"]
        token = self._settings.telegram_bot_token
        return f"https://api.telegram.org/file/bot{token}/{path}"


_adapter: TelegramAdapter | None = None


def get_telegram_adapter() -> TelegramAdapter:
    global _adapter
    if _adapter is None:
        _adapter = TelegramAdapter()
    return _adapter
