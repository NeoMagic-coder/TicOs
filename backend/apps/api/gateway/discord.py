"""Discord Bot gateway adapter.

Uses the Discord REST API directly (no discord.py dependency) so the adapter
stays lightweight and async-native. Receives events via the webhooks route
(interaction POSTs) or via the gateway WebSocket when the bot token is set.

For production the recommended approach is slash-command interactions
(registered via POST /applications/{id}/commands). The webhook route
handles APPLICATION_COMMAND interactions — no WebSocket needed.
"""
from __future__ import annotations

from typing import Any

import httpx

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger
from apps.api.gateway.base import BaseGatewayAdapter

log = get_logger(__name__)

_DISCORD_API = "https://discord.com/api/v10"


class DiscordAdapter(BaseGatewayAdapter):
    platform = "discord"

    def __init__(self) -> None:
        self._settings = get_settings()

    async def start(self) -> None:
        if not self._settings.discord_bot_token:
            log.info("gateway.discord.disabled", reason="no bot token")
            return
        log.info("gateway.discord.ready", mode="interactions-webhook")

    async def stop(self) -> None:
        pass

    async def send_message(self, chat_id: str, text: str) -> None:
        """Send a message to a Discord channel (channel_id as chat_id)."""
        if not self._settings.discord_bot_token:
            return
        headers = {"Authorization": f"Bot {self._settings.discord_bot_token}"}
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{_DISCORD_API}/channels/{chat_id}/messages",
                headers=headers,
                json={"content": text[:2000]},  # Discord 2000-char limit
            )

    async def handle_interaction(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Handle a Discord interaction (APPLICATION_COMMAND or MESSAGE_COMPONENT).

        Returns an interaction response dict for Discord's ACK+response protocol.
        """
        interaction_type = payload.get("type")
        # Type 1 = PING (Discord healthcheck)
        if interaction_type == 1:
            return {"type": 1}

        data = payload.get("data", {})
        user = payload.get("member", {}).get("user") or payload.get("user", {})
        channel_id = str(payload.get("channel_id", ""))
        user_id = str(user.get("id", "unknown"))

        # Resolve the user's text: slash command options → "name value value…"
        options = data.get("options", [])
        text_parts = [data.get("name", "")]
        for opt in options:
            if "value" in opt:
                text_parts.append(str(opt["value"]))
        text = " ".join(text_parts).strip() or data.get("name", "")

        # Acknowledge immediately (type 5 = DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE)
        # and handle the actual response asynchronously.
        import asyncio
        asyncio.create_task(self.handle_incoming(user_id, channel_id, text))
        return {"type": 5}

    async def handle_message(self, payload: dict[str, Any]) -> None:
        """Handle a MESSAGE_CREATE gateway event (used if WebSocket mode is enabled)."""
        if payload.get("author", {}).get("bot"):
            return
        channel_id = str(payload.get("channel_id", ""))
        user_id = str(payload.get("author", {}).get("id", "unknown"))
        content: str = payload.get("content", "")
        if content:
            await self.handle_incoming(user_id, channel_id, content)


_adapter: DiscordAdapter | None = None


def get_discord_adapter() -> DiscordAdapter:
    global _adapter
    if _adapter is None:
        _adapter = DiscordAdapter()
    return _adapter
