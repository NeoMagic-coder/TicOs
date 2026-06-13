"""Image generation — Bedrock Runtime (Stability/Titan) with SVG placeholder fallback.

Configure via env:
- ``AWS_BEARER_TOKEN_BEDROCK`` + ``BEDROCK_IMAGE_MODEL`` (Stability Image Core önerilir)
- ``FAL_API_KEY`` — Bedrock başarısız olunca fal.ai
- ``IMAGE_PLACEHOLDER_FALLBACK=true`` — son çare marka SVG yer tutucu
"""
from __future__ import annotations

import html
import uuid
from pathlib import Path
from typing import Any

import httpx

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger

log = get_logger(__name__)

IMAGES_DIR = Path(__file__).resolve().parents[3] / "_images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

_VARIATION_STYLES = (
    "hero shot, merkezi kompozisyon, stüdyo ışığı",
    "lifestyle sahne, doğal ortam, sıcak tonlar",
    "flat lay, üstten görünüm, minimal arka plan",
    "macro detail, doku ve malzeme vurgusu",
)


def variation_prompt(prompt: str, variation_index: int | None = None) -> str:
    if variation_index is None:
        return prompt
    style = _VARIATION_STYLES[int(variation_index) % len(_VARIATION_STYLES)]
    return f"{prompt.rstrip('.')}. Varyasyon {int(variation_index) + 1}: {style}."


def describe_image_provider() -> dict[str, Any]:
    """Read-only snapshot for /health and UI badges."""
    settings = get_settings()
    bedrock = bool(settings.aws_bearer_token_bedrock)
    fal = bool(settings.fal_api_key)
    if bedrock:
        mode = "bedrock"
    elif fal:
        mode = "fal"
    elif settings.image_placeholder_fallback:
        mode = "placeholder"
    else:
        mode = "none"
    from apps.api.core.llm.bedrock_runtime import is_bedrock_image_denied

    return {
        "mode": mode,
        "bedrock_token_present": bedrock,
        "bedrock_image_model": settings.bedrock_image_model,
        "bedrock_image_fallback_models": settings.bedrock_image_fallback_models,
        "fal_configured": fal,
        "placeholder_fallback": settings.image_placeholder_fallback,
        "bedrock_image_probe": settings.bedrock_image_probe,
        "bedrock_image_denied_cached": is_bedrock_image_denied(),
        "ready": bedrock or fal or settings.image_placeholder_fallback,
        "hint_tr": (
            "Gerçek AI görsel için AWS Console → Bedrock → Model access → "
            "Stability Image Core (stability.stable-image-core-v1:1) etkinleştirin."
            if bedrock and not fal
            else (
                "fal.ai yedek anahtarı yapılandırıldı."
                if fal
                else "AWS_BEARER_TOKEN_BEDROCK veya FAL_API_KEY gerekli."
            )
        ),
    }


def _use_bedrock(settings: Any) -> bool:
    explicit = (getattr(settings, "image_provider", "") or "").lower().strip()
    if explicit == "bedrock":
        return bool(settings.aws_bearer_token_bedrock)
    if explicit in ("fal", "placeholder"):
        return False
    return bool(settings.aws_bearer_token_bedrock)


def _short_error(exc: Exception) -> str:
    msg = str(exc)
    if "Operation not allowed" in msg:
        return "Bedrock görsel modeli için API anahtarı izni yok — AWS Console'da Stability Image Core erişimini açın."
    if "end of its life" in msg.lower():
        return "Görsel modeli artık desteklenmiyor — BEDROCK_IMAGE_MODEL güncelleyin."
    return msg[:220]


async def generate_image(
    prompt: str,
    *,
    model: str | None = None,
    variation_index: int | None = None,
) -> dict[str, Any]:
    """Generate image; never raises when ``image_placeholder_fallback`` is enabled."""
    settings = get_settings()
    prompt = variation_prompt(prompt, variation_index)

    if _use_bedrock(settings) and settings.bedrock_image_probe:
        from apps.api.core.llm.bedrock_runtime import generate_image as bedrock_image, is_bedrock_image_denied

        if not is_bedrock_image_denied():
            try:
                data, mime, used_model = await bedrock_image(prompt, model_id=model or settings.bedrock_image_model)
                return _save_bytes(data, mime, prompt=prompt, model=used_model, provider="bedrock")
            except Exception as exc:
                log.warning("image.bedrock_failed", error=str(exc)[:240])
                if settings.fal_api_key:
                    log.info("image.fallback_to_fal", reason="bedrock_failed")
                    fal_model = model if (model and model.startswith("fal-ai/")) else settings.fal_image_model
                    out = await _fal_generate(prompt, model=fal_model, api_key=settings.fal_api_key)
                    if "error" not in out:
                        return out

    if settings.fal_api_key and not _use_bedrock(settings):
        fal_model = model if (model and model.startswith("fal-ai/")) else settings.fal_image_model
        out = await _fal_generate(prompt, model=fal_model, api_key=settings.fal_api_key)
        if "error" not in out:
            return out

    if settings.image_placeholder_fallback:
        return _placeholder_svg(prompt, variation_index=variation_index)

    return {"error": "Görsel sağlayıcı yapılandırılmamış (Bedrock model erişimi veya FAL_API_KEY gerekli)"}


async def generate_image_safe(
    prompt: str,
    *,
    model: str | None = None,
    variation_index: int | None = None,
) -> dict[str, Any]:
    """Adapter entrypoint — always returns a dict with ``url`` when placeholders are on."""
    settings = get_settings()
    try:
        out = await generate_image(prompt, model=model, variation_index=variation_index)
        if out.get("url"):
            return out
        if settings.image_placeholder_fallback:
            return _placeholder_svg(variation_prompt(prompt, variation_index), variation_index=variation_index)
        return out
    except Exception as exc:
        log.warning("image.generate_exception", error=str(exc)[:200])
        if settings.image_placeholder_fallback:
            return _placeholder_svg(variation_prompt(prompt, variation_index), variation_index=variation_index)
        return {"error": str(exc)[:220]}


def _placeholder_svg(prompt: str, *, variation_index: int | None = None) -> dict[str, Any]:
    """Deterministic brand-style SVG when cloud image APIs are unavailable."""
    label = html.escape((prompt or "Marka görseli")[:80])
    idx = int(variation_index or 0)
    hues = [(26, 26, 46), (22, 33, 62), (15, 52, 96), (45, 30, 80)]
    r, g, b = hues[idx % len(hues)]
    accent = ["#ffb13d", "#10b981", "#60a5fa", "#c084fc"][idx % 4]
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:rgb({r},{g},{b})"/>
      <stop offset="100%" style="stop-color:rgb({max(r-8,0)},{max(g-8,0)},{min(b+40,255)})"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect x="64" y="64" width="896" height="896" rx="32" fill="none" stroke="{accent}" stroke-opacity="0.35" stroke-width="2"/>
  <text x="512" y="460" text-anchor="middle" fill="rgba(255,255,255,0.92)" font-family="system-ui,sans-serif" font-size="28" font-weight="600">Marka Görseli · V{idx + 1}</text>
  <text x="512" y="540" text-anchor="middle" fill="rgba(255,255,255,0.55)" font-family="system-ui,sans-serif" font-size="16">{label}</text>
  <text x="512" y="920" text-anchor="middle" fill="{accent}" font-family="monospace" font-size="14">placeholder · Bedrock Image erişimi gerekli</text>
</svg>"""
    file_id = uuid.uuid4().hex[:12]
    path = IMAGES_DIR / f"{file_id}.svg"
    path.write_text(svg, encoding="utf-8")
    return {
        "url": f"/images/{path.name}",
        "path": str(path),
        "filename": path.name,
        "prompt": prompt,
        "model": "placeholder-svg",
        "mime": "image/svg+xml",
        "size_bytes": len(svg.encode("utf-8")),
        "provider": "placeholder",
        "degraded": True,
        "degraded_reason": "bedrock_image_unavailable",
    }


async def _fal_generate(prompt: str, *, model: str, api_key: str) -> dict[str, Any]:
    url = f"https://fal.run/{model.lstrip('/')}"
    headers = {"Authorization": f"Key {api_key}", "Content-Type": "application/json"}
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
    ext = "png" if "png" in mime else ("jpg" if "jpeg" in mime else ("webp" if "webp" in mime else ("svg" if "svg" in mime else "bin")))
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
