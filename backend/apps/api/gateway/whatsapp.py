"""Twilio WhatsApp gateway adapter.

Receives POST /webhooks/whatsapp events from Twilio's webhook, handles
text and voice messages, and replies via the Twilio Messaging API.
"""
from __future__ import annotations

from typing import Any
from urllib.parse import urlencode

import httpx

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger
from apps.api.gateway.base import BaseGatewayAdapter

log = get_logger(__name__)

_TWILIO_API = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"


class WhatsAppAdapter(BaseGatewayAdapter):
    platform = "whatsapp"

    def __init__(self) -> None:
        self._settings = get_settings()

    async def start(self) -> None:
        if not self._settings.twilio_account_sid:
            log.info("gateway.whatsapp.disabled", reason="no Twilio credentials")
            return
        log.info("gateway.whatsapp.ready", mode="webhook")

    async def stop(self) -> None:
        pass

    async def send_message(self, chat_id: str, text: str) -> None:
        """Send a WhatsApp message via Twilio. chat_id is "whatsapp:+XXXXXXXXX"."""
        s = self._settings
        if not s.twilio_account_sid or not s.twilio_auth_token:
            return
        url = _TWILIO_API.format(sid=s.twilio_account_sid)
        payload = {
            "From": s.twilio_whatsapp_from or "whatsapp:+14155238886",
            "To": chat_id,
            "Body": text,
        }
        async with httpx.AsyncClient(timeout=15) as client:
            await client.post(
                url,
                data=payload,
                auth=(s.twilio_account_sid, s.twilio_auth_token),
            )

    async def handle_webhook(self, form: dict[str, Any]) -> str:
        """Handle a Twilio inbound webhook (form-encoded body).

        Returns a TwiML response string (empty <Response/> to suppress auto-reply).
        """
        from_number: str = form.get("From", "")  # "whatsapp:+905XXXXXXXXX"
        body: str = form.get("Body", "").strip()
        media_url: str = form.get("MediaUrl0", "")
        media_type: str = form.get("MediaContentType0", "")

        if not from_number:
            return "<Response/>"

        voice_url: str | None = None
        if media_url and media_type.startswith("audio/"):
            voice_url = media_url

        if body or voice_url:
            import asyncio
            asyncio.create_task(
                self.handle_incoming(from_number, from_number, body, voice_url=voice_url)
            )

        return "<Response/>"


_adapter: WhatsAppAdapter | None = None


def get_whatsapp_adapter() -> WhatsAppAdapter:
    global _adapter
    if _adapter is None:
        _adapter = WhatsAppAdapter()
    return _adapter
