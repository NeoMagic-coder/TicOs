"""Inbound webhooks.

``POST /webhooks/shopify`` — verifies the ``X-Shopify-Hmac-Sha256`` header
against ``settings.shopify_webhook_secret`` using a constant-time compare, then
parses the payload. The topic comes from ``X-Shopify-Topic`` (e.g.
``orders/create``, ``inventory_levels/update``).

``POST /webhooks/telegram`` — receives Telegram Bot API updates. Verifies the
``X-Telegram-Bot-Api-Secret-Token`` header when ``TELEGRAM_WEBHOOK_SECRET`` is
set, then routes the message text through Hermes and replies via sendMessage.

For local testing point your shop's webhook URL through ngrok::

    ngrok http 8000
    # Shopify Admin → Notifications → Webhooks → URL = https://<id>.ngrok.io/webhooks/shopify
    # Format = JSON, signing secret = SHOPIFY_WEBHOOK_SECRET

When the secret is empty the route returns 503 so misconfigured environments
fail loudly rather than silently accepting unverified payloads.
"""
from __future__ import annotations

import base64
import hashlib
import hmac

from fastapi import APIRouter, Header, HTTPException, Request

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
log = get_logger(__name__)


@router.post("/shopify")
async def shopify_webhook(
    request: Request,
    x_shopify_hmac_sha256: str | None = Header(default=None),
    x_shopify_topic: str | None = Header(default=None),
    x_shopify_shop_domain: str | None = Header(default=None),
) -> dict[str, str]:
    settings = get_settings()
    if not settings.shopify_webhook_secret:
        # Fail loud rather than accept unverified data.
        raise HTTPException(status_code=503, detail="shopify_webhook_secret not configured")

    raw = await request.body()
    expected = base64.b64encode(
        hmac.new(
            key=settings.shopify_webhook_secret.encode("utf-8"),
            msg=raw,
            digestmod=hashlib.sha256,
        ).digest()
    ).decode("utf-8")

    if not x_shopify_hmac_sha256 or not hmac.compare_digest(expected, x_shopify_hmac_sha256):
        log.warning("webhook.shopify.hmac_invalid", topic=x_shopify_topic, shop=x_shopify_shop_domain)
        raise HTTPException(status_code=401, detail="invalid HMAC")

    log.info(
        "webhook.shopify.accepted",
        topic=x_shopify_topic,
        shop=x_shopify_shop_domain,
        bytes=len(raw),
    )
    # Hand-off point: enqueue or dispatch by topic. Phase 1 just acks.
    return {"status": "ok", "topic": x_shopify_topic or "unknown"}


@router.post("/telegram")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict[str, str]:
    """Receive Telegram Bot updates and route through the session-aware gateway."""
    import asyncio
    from apps.api.gateway.telegram import get_telegram_adapter

    settings = get_settings()
    if not settings.telegram_bot_token:
        raise HTTPException(status_code=503, detail="telegram_bot_token not configured")

    adapter = get_telegram_adapter()
    if settings.telegram_webhook_secret and not adapter.verify_secret(x_telegram_bot_api_secret_token or ""):
        log.warning("webhook.telegram.secret_invalid")
        raise HTTPException(status_code=401, detail="invalid secret token")

    body = await request.json()
    asyncio.create_task(adapter.handle_update(body))
    return {"status": "ok"}


# ──────────────────────────────────────────────────────
# Discord
# ──────────────────────────────────────────────────────

@router.post("/discord")
async def discord_webhook(request: Request) -> dict:
    """Handle Discord interaction webhooks (slash commands and component events)."""
    from apps.api.gateway.discord import get_discord_adapter

    settings = get_settings()
    if not settings.discord_bot_token:
        raise HTTPException(status_code=503, detail="discord_bot_token not configured")

    body = await request.json()
    adapter = get_discord_adapter()
    return await adapter.handle_interaction(body)


# ──────────────────────────────────────────────────────
# Slack
# ──────────────────────────────────────────────────────

@router.post("/slack")
async def slack_webhook(
    request: Request,
    x_slack_request_timestamp: str | None = Header(default=None),
    x_slack_signature: str | None = Header(default=None),
) -> dict | None:
    """Handle Slack Events API payloads (app_mention, message, url_verification)."""
    from apps.api.gateway.slack import get_slack_adapter

    settings = get_settings()
    if not settings.slack_bot_token:
        raise HTTPException(status_code=503, detail="slack_bot_token not configured")

    raw = await request.body()
    adapter = get_slack_adapter()

    if settings.slack_signing_secret:
        if not adapter.verify_signature(raw, x_slack_request_timestamp or "", x_slack_signature or ""):
            log.warning("webhook.slack.signature_invalid")
            raise HTTPException(status_code=401, detail="invalid signature")

    body = await request.json()
    result = await adapter.handle_event(body)
    return result or {"ok": True}


# ──────────────────────────────────────────────────────
# WhatsApp (Twilio)
# ──────────────────────────────────────────────────────

@router.post("/whatsapp")
async def whatsapp_webhook(request: Request):
    """Handle Twilio inbound WhatsApp messages (form-encoded body)."""
    from fastapi.responses import PlainTextResponse
    from apps.api.gateway.whatsapp import get_whatsapp_adapter

    settings = get_settings()
    if not settings.twilio_account_sid:
        raise HTTPException(status_code=503, detail="twilio credentials not configured")

    form = dict(await request.form())
    adapter = get_whatsapp_adapter()
    twiml = await adapter.handle_webhook(form)
    return PlainTextResponse(content=twiml, media_type="text/xml")
