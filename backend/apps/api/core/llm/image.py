"""Image generation. Tries Gemini first, falls back to fal.ai when Gemini
returns 429 (free-tier quota exhausted) or no API key is configured.

Configure via env:
- ``GEMINI_API_KEY`` for Gemini (``gemini-3-pro-image-preview`` by default)
- ``FAL_API_KEY`` for fal.ai (``fal-ai/flux/schnell`` by default)

Returns ``{url, path, filename, prompt, model, mime, size_bytes, provider}``
on success, or ``{error: ...}`` on failure.
"""
from __future__ import annotations

import base64
import uuid
from pathlib import Path
from typing import Any

import httpx

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger

log = get_logger(__name__)

IMAGES_DIR = Path(__file__).resolve().parents[3] / "_images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)


async def generate_image(
    prompt: str,
    *,
    model: str | None = None,
) -> dict[str, Any]:
    """Generate one image from a text prompt.

    Selection order:
    1. Gemini (if ``GEMINI_API_KEY`` set). On 429/quota error, falls through to fal.
    2. fal.ai (if ``FAL_API_KEY`` set).
    3. Error.
    """
    settings = get_settings()

    if settings.gemini_api_key:
        gemini_model = model or "gemini-3-pro-image-preview"
        result = await _gemini_generate(prompt, model=gemini_model, api_key=settings.gemini_api_key)
        # Only fall through to fal on quota/billing errors — propagate other errors
        if "error" not in result:
            return result
        err = result.get("error") or ""
        is_quota = "429" in err or "RESOURCE_EXHAUSTED" in err or "quota" in err.lower() or "billing" in err.lower()
        if not (is_quota and settings.fal_api_key):
            return result
        log.info("image.fallback_to_fal", reason="gemini_quota")

    if settings.fal_api_key:
        fal_model = model if (model and model.startswith("fal-ai/")) else settings.fal_image_model
        return await _fal_generate(prompt, model=fal_model, api_key=settings.fal_api_key)

    return {"error": "No image provider configured (set GEMINI_API_KEY or FAL_API_KEY)"}


async def _gemini_generate(prompt: str, *, model: str, api_key: str) -> dict[str, Any]:
    from google import genai
    from google.genai import errors as genai_errors
    from google.genai import types

    client = genai.Client(api_key=api_key)

    try:
        response = await client.aio.models.generate_content(
            model=model,
            contents=[types.Content(role="user", parts=[types.Part.from_text(text=prompt)])],
            config=types.GenerateContentConfig(
                response_modalities=["TEXT", "IMAGE"],
            ),
        )
    except genai_errors.ClientError as exc:
        status = getattr(exc, "code", None) or getattr(exc, "status_code", None)
        log.warning("image.gemini.client_error", status=status, error=str(exc)[:200])
        return {"error": f"Gemini {status}: {str(exc)[:200]}"}
    except Exception as exc:
        log.exception("image.gemini.exception", error=str(exc))
        return {"error": f"Gemini image error: {exc}"}

    parts = (response.candidates or [None])[0]
    if parts is None or not parts.content or not parts.content.parts:
        return {"error": "Empty response from Gemini image model"}

    for part in parts.content.parts:
        inline = getattr(part, "inline_data", None)
        if inline and inline.data:
            data = inline.data if isinstance(inline.data, bytes) else base64.b64decode(inline.data)
            mime = getattr(inline, "mime_type", "image/png") or "image/png"
            return _save_bytes(data, mime, prompt=prompt, model=model, provider="gemini")

    return {"error": "No inline image data in Gemini response"}


async def _fal_generate(prompt: str, *, model: str, api_key: str) -> dict[str, Any]:
    """Synchronous fal.ai call via ``fal.run/{model}``.

    Returns the first image, saved locally. The fal.ai response shape is:
    ``{"images": [{"url", "content_type", "width", "height"}], "seed", ...}``.
    """
    url = f"https://fal.run/{model.lstrip('/')}"
    headers = {
        "Authorization": f"Key {api_key}",
        "Content-Type": "application/json",
    }
    payload = {"prompt": prompt, "num_images": 1}

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            body = resp.json()
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code
        log.warning("image.fal.http_error", status=status, body=exc.response.text[:200])
        return {"error": f"fal.ai HTTP {status}: {exc.response.text[:200]}"}
    except Exception as exc:
        log.exception("image.fal.exception", error=str(exc))
        return {"error": f"fal.ai error: {exc}"}

    images = body.get("images") or []
    if not images:
        return {"error": "Empty fal.ai response (no images)"}

    img_url = images[0].get("url")
    if not img_url:
        return {"error": "fal.ai response missing image url"}

    # Download the image and save locally so the response shape matches Gemini.
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            img_resp = await client.get(img_url)
            img_resp.raise_for_status()
            data = img_resp.content
    except Exception as exc:
        log.warning("image.fal.download_failed", error=str(exc)[:200])
        return {"error": f"fal.ai image download failed: {exc}"}

    mime = images[0].get("content_type") or "image/png"
    return _save_bytes(data, mime, prompt=prompt, model=model, provider="fal")


def _save_bytes(
    data: bytes,
    mime: str,
    *,
    prompt: str,
    model: str,
    provider: str,
) -> dict[str, Any]:
    ext = "png" if "png" in mime else ("jpg" if "jpeg" in mime else ("webp" if "webp" in mime else "bin"))
    file_id = uuid.uuid4().hex[:12]
    path = IMAGES_DIR / f"{file_id}.{ext}"
    path.write_bytes(data)
    return {
        "url": f"/images/{path.name}",
        "path": str(path),
        "filename": path.name,
        "prompt": prompt,
        "model": model,
        "mime": mime,
        "size_bytes": len(data),
        "provider": provider,
    }
