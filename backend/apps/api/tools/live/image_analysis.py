"""image_analysis live adapter.

Uses Amazon Bedrock multimodal Converse API to extract category/colors/material
from a product image. Falls back to a deterministic mock when no
AWS_BEARER_TOKEN_BEDROCK is set or when the call fails.
"""
from __future__ import annotations

import base64
import binascii
import json
import re
from typing import Any

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger
from apps.api.core.openclaw.breaker import with_breaker
from apps.api.core.openclaw.executor import register_live_adapter

log = get_logger(__name__)

_FENCE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.DOTALL | re.IGNORECASE)


def _parse_json(text: str) -> dict[str, Any] | None:
    text = (text or "").strip()
    if not text:
        return None
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        pass
    m = _FENCE.search(text)
    if m:
        try:
            data = json.loads(m.group(1))
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            pass
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        try:
            data = json.loads(text[start : end + 1])
            return data if isinstance(data, dict) else None
        except json.JSONDecodeError:
            return None
    return None


_FALLBACK: dict[str, Any] = {
    "category": "genel",
    "colors": ["siyah"],
    "material": "karma",
    "features": ["mock — Bedrock bağlı değil"],
    "confidence": 0.4,
    "degraded": True,
}


_SYS = (
    "Sen bir ürün görsel analiz uzmanısın. Verilen ürün fotoğrafına bakıp "
    "Türkçe kategori, baskın renkler, tahmini materyal ve dikkat çeken "
    "görsel özellikleri çıkar. Yanıtı YALNIZCA JSON döndür:\n"
    '{"category": "string (örn. çanta, tencere, kozmetik)", '
    '"colors": ["en fazla 3 renk"], '
    '"material": "string", '
    '"features": ["en fazla 5 kısa özellik"], '
    '"confidence": 0-1 arası float}'
)


def _decode_image(payload: dict[str, Any]) -> tuple[bytes | None, str]:
    """Return (raw_bytes, mime_type). Bytes is None if payload only has a URL."""
    b64 = payload.get("image_b64")
    if b64 and isinstance(b64, str):
        mime = "image/jpeg"
        if b64.startswith("data:"):
            head, _, body = b64.partition(",")
            m = re.match(r"data:([^;]+);base64", head)
            if m:
                mime = m.group(1)
            b64 = body
        try:
            return base64.b64decode(b64, validate=False), mime
        except (binascii.Error, ValueError) as exc:
            log.warning("image_analysis.b64_decode_failed", error=str(exc)[:120])
            return None, mime
    return None, "image/jpeg"


async def _adapter(payload: dict[str, Any]) -> dict[str, Any]:
    settings = get_settings()
    if not settings.aws_bearer_token_bedrock:
        return {**_FALLBACK, "degraded_reason": "no_api_key"}

    image_bytes, mime = _decode_image(payload)
    image_url = payload.get("image_url")
    if not image_bytes and not image_url:
        return {**_FALLBACK, "degraded_reason": "no_image"}

    product_name = str(payload.get("product_name") or "").strip()[:200]
    user_text = f"Ürün adı (ipucu): {product_name}" if product_name else "Bu ürünü analiz et."
    if not image_bytes and image_url:
        user_text = f"{user_text}\nÜrün görseli URL: {image_url}"

    try:
        from apps.api.core.llm.bedrock_runtime import converse

        text = await converse(
            settings.bedrock_vision_model,
            system=_SYS,
            user_text=user_text,
            image_bytes=image_bytes,
            mime=mime,
            max_tokens=400,
        )
    except Exception as exc:
        log.warning("image_analysis.exception", error=str(exc)[:200])
        return {**_FALLBACK, "degraded_reason": "llm_exception"}

    parsed = _parse_json(text)
    if not parsed:
        return {**_FALLBACK, "degraded_reason": "json_parse_failed"}

    out: dict[str, Any] = {
        "category": str(parsed.get("category") or _FALLBACK["category"]),
        "colors": list(parsed.get("colors") or _FALLBACK["colors"])[:3],
        "material": str(parsed.get("material") or _FALLBACK["material"]),
        "features": list(parsed.get("features") or [])[:5],
        "confidence": float(parsed.get("confidence") or 0.7),
    }
    return out


async def _mock(_payload: dict[str, Any]) -> dict[str, Any]:
    return {**_FALLBACK, "degraded_reason": "breaker_open"}


def register() -> None:
    register_live_adapter(
        "image_analysis",
        with_breaker(tool_id="image_analysis", adapter=_adapter, mock_fallback=_mock),
    )
    log.info("live.image_analysis.registered")
