"""Slack Events API gateway adapter.

Receives POST /webhooks/slack events, verifies the request signature,
and handles `app_mention` + `message` events. Responds via the Web API
(chat.postMessage).
"""
from __future__ import annotations

import hashlib
import hmac
import time
from typing import Any

import httpx

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger
from apps.api.gateway.base import BaseGatewayAdapter

log = get_logger(__name__)

_SLACK_API = "https://slack.com/api"


class SlackAdapter(BaseGatewayAdapter):
    platform = "slack"

    def __init__(self) -> None:
        self._settings = get_settings()

    async def start(self) -> None:
        if not self._settings.slack_bot_token:
            log.info("gateway.slack.disabled", reason="no bot token")
            return
        log.info("gateway.slack.ready", mode="events-api")

    async def stop(self) -> None:
        pass

    async def send_message(self, chat_id: str, text: str) -> None:
        """Post a message to a Slack channel (channel ID as chat_id)."""
        if not self._settings.slack_bot_token:
            return
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{_SLACK_API}/chat.postMessage",
                headers={"Authorization": f"Bearer {self._settings.slack_bot_token}"},
                json={"channel": chat_id, "text": text},
            )

    def verify_signature(self, body: bytes, timestamp: str, signature: str) -> bool:
        """Verify Slack request signature (HMAC-SHA256)."""
        secret = self._settings.slack_signing_secret
        if not secret:
            return True
        # Reject stale requests (>5 minutes)
        try:
            if abs(time.time() - int(timestamp)) > 300:
                return False
        except ValueError:
            return False
        base = f"v0:{timestamp}:{body.decode()}"
        expected = "v0=" + hmac.new(key=secret.encode(), msg=base.encode(), digestmod=hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    async def handle_event(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        """Handle a Slack Events API payload. Returns a URL verification challenge if needed."""
        # URL verification challenge
        if payload.get("type") == "url_verification":
            return {"challenge": payload.get("challenge")}

        event = payload.get("event", {})
        event_type = event.get("type", "")

        # Ignore bot messages and retries
        if event.get("bot_id") or event.get("subtype"):
            return None

        if event_type in ("message", "app_mention"):
            user_id = str(event.get("user", "unknown"))
            channel = str(event.get("channel", ""))
            text: str = event.get("text", "")
            if text and channel:
                import asyncio
                asyncio.create_task(self.handle_incoming(user_id, channel, text))

        return None


_adapter: SlackAdapter | None = None


def get_slack_adapter() -> SlackAdapter:
    global _adapter
    if _adapter is None:
        _adapter = SlackAdapter()
    return _adapter
