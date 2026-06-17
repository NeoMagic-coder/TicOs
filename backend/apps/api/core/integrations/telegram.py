"""Telegram Bot API client helper.

Minimal wrapper around the Bot API sendMessage endpoint. Uses httpx for
async HTTP so it shares the event loop with FastAPI. Never raises — failures
are logged and return False so callers can handle degraded mode.

Requires TELEGRAM_BOT_TOKEN in settings. All outbound calls degrade
gracefully when the token is absent (function returns False immediately).

Setup:
    1. Create a bot via @BotFather → obtain token
    2. Set TELEGRAM_BOT_TOKEN=<token> in .env.local
    3. Register webhook:
         POST https://api.telegram.org/bot<TOKEN>/setWebhook
              ?url=https://<your-host>/webhooks/telegram
              &secret_token=<TELEGRAM_WEBHOOK_SECRET>
    4. Optionally set TELEGRAM_WEBHOOK_SECRET for header verification.
"""
from __future__ import annotations

from typing import Any

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger

log = get_logger(__name__)

_BASE = "https://api.telegram.org/bot{token}"


def _bot_url(method: str) -> str:
    token = get_settings().telegram_bot_token
    return f"{_BASE.format(token=token)}/{method}"


async def send_message(
    chat_id: int | str,
    text: str,
    *,
    parse_mode: str = "HTML",
    disable_notification: bool = False,
) -> bool:
    """Send a text message to a Telegram chat. Returns True on success."""
    settings = get_settings()
    if not settings.telegram_bot_token:
        log.debug("telegram.send_message.skipped", reason="no token configured")
        return False

    text = text[:4096]  # Telegram max message length

    try:
        import httpx
        payload: dict[str, Any] = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode,
            "disable_notification": disable_notification,
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(_bot_url("sendMessage"), json=payload)
            if resp.status_code != 200:
                log.warning(
                    "telegram.send_message.failed",
                    chat_id=chat_id,
                    status=resp.status_code,
                    body=resp.text[:200],
                )
                return False
        return True
    except Exception as exc:
        log.warning("telegram.send_message.error", chat_id=chat_id, error=str(exc)[:200])
        return False


async def answer_typing(chat_id: int | str) -> None:
    """Send a typing action indicator. Fire-and-forget, never raises."""
    settings = get_settings()
    if not settings.telegram_bot_token:
        return
    try:
        import httpx
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(_bot_url("sendChatAction"), json={
                "chat_id": chat_id,
                "action": "typing",
            })
    except Exception:
        pass
