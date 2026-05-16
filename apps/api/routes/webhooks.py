"""Inbound webhooks.

``POST /webhooks/shopify`` — verifies the ``X-Shopify-Hmac-Sha256`` header
against ``settings.shopify_webhook_secret`` using a constant-time compare, then
parses the payload. The topic comes from ``X-Shopify-Topic`` (e.g.
``orders/create``, ``inventory_levels/update``).

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
