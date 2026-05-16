"""Gemini image generation. Uses google-genai SDK + gemini-3-pro-image-preview (Nano Banana 2)."""
from __future__ import annotations

import base64
import uuid
from pathlib import Path
from typing import Any

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger

log = get_logger(__name__)

IMAGES_DIR = Path(__file__).resolve().parents[3] / "_images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)


async def generate_image(
    prompt: str,
    *,
    model: str = "gemini-3-pro-image-preview",
) -> dict[str, Any]:
    """Generate one image from a text prompt. Returns {url, path, prompt, model, mime}.

    Saves the PNG under _images/ and returns its public URL (served via /images mount).
    """
    settings = get_settings()
    if not settings.gemini_api_key:
        return {"error": "GEMINI_API_KEY missing"}

    from google import genai
    from google.genai import errors as genai_errors
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)

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
        log.warning("image.client_error", status=status, error=str(exc)[:200])
        return {"error": f"Gemini {status}: {str(exc)[:200]}"}
    except Exception as exc:
        log.exception("image.exception", error=str(exc))
        return {"error": f"Image gen error: {exc}"}

    parts = (response.candidates or [None])[0]
    if parts is None or not parts.content or not parts.content.parts:
        return {"error": "Empty response from image model"}

    for part in parts.content.parts:
        inline = getattr(part, "inline_data", None)
        if inline and inline.data:
            data = inline.data if isinstance(inline.data, bytes) else base64.b64decode(inline.data)
            mime = getattr(inline, "mime_type", "image/png") or "image/png"
            ext = "png" if "png" in mime else ("jpg" if "jpeg" in mime else "bin")
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
            }

    return {"error": "No inline image data in response"}
