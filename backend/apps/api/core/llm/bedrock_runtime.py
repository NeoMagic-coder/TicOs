"""Amazon Bedrock Runtime helpers (invoke + converse) + Mantle chat for vision.

Image generation uses ``bedrock-runtime`` InvokeModel (Stability / Titan).
Mantle ``/v1/images/generations`` is NOT available — do not call it.
"""
from __future__ import annotations

import base64
import re
from typing import Any

import httpx

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger

log = get_logger(__name__)

_TIMEOUT = httpx.Timeout(90.0)
_IMAGE_TIMEOUT = httpx.Timeout(8.0)
# After 403/400 on image invoke, skip further Bedrock attempts for this process.
_runtime_image_denied: bool = False


def is_bedrock_image_denied() -> bool:
    return _runtime_image_denied


def reset_bedrock_image_denied() -> None:
    global _runtime_image_denied
    _runtime_image_denied = False


def _token() -> str:
    token = get_settings().aws_bearer_token_bedrock
    if not token:
        raise RuntimeError("AWS_BEARER_TOKEN_BEDROCK not configured")
    return token


def _headers(*, accept: str = "application/json") -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_token()}",
        "Content-Type": "application/json",
        "Accept": accept,
    }


def _mantle_url(path: str) -> str:
    base = get_settings().bedrock_base_url.rstrip("/")
    if base.endswith("/v1"):
        return f"{base}{path}"
    return f"{base}/v1{path}"


def _runtime_url(model_id: str, *, action: str = "invoke") -> str:
    region = get_settings().bedrock_region or "us-east-1"
    if action == "converse":
        return f"https://bedrock-runtime.{region}.amazonaws.com/model/{model_id}/converse"
    return f"https://bedrock-runtime.{region}.amazonaws.com/model/{model_id}/invoke"


async def _mantle_post(path: str, body: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(_mantle_url(path), headers=_headers(), json=body)
        if resp.status_code >= 400:
            raise RuntimeError(f"Mantle {path} {resp.status_code}: {resp.text[:240]}")
        return resp.json()


async def invoke_model(model_id: str, body: dict[str, Any], *, timeout: httpx.Timeout | None = None) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=timeout or _TIMEOUT) as client:
        resp = await client.post(_runtime_url(model_id), headers=_headers(), json=body)
        if resp.status_code >= 400:
            err = resp.text[:300]
            log.warning("bedrock_runtime.invoke_error", model=model_id, status=resp.status_code, error=err)
            resp.raise_for_status()
        return resp.json()


def _image_invoke_body(model_id: str, prompt: str) -> dict[str, Any]:
    mid = model_id.lower()
    if mid.startswith("amazon.titan-image"):
        return {
            "taskType": "TEXT_IMAGE",
            "textToImageParams": {"text": prompt},
            "imageGenerationConfig": {"numberOfImages": 1, "height": 1024, "width": 1024},
        }
    if mid.startswith("stability."):
        # Stable Image Core / Ultra — simple prompt JSON (not legacy SDXL text_prompts).
        return {"prompt": prompt}
    return {"prompt": prompt, "text_prompts": [{"text": prompt, "weight": 1.0}]}


async def _runtime_converse(
    model_id: str,
    *,
    system: str,
    user_text: str,
    image_bytes: bytes | None,
    mime: str,
    max_tokens: int,
) -> str:
    content: list[dict[str, Any]] = []
    if image_bytes:
        fmt = (mime.split("/")[-1] or "jpeg").lower()
        if fmt == "jpg":
            fmt = "jpeg"
        content.append(
            {
                "image": {
                    "format": fmt,
                    "source": {"bytes": base64.b64encode(image_bytes).decode("ascii")},
                }
            }
        )
    content.append({"text": user_text})

    body: dict[str, Any] = {
        "messages": [{"role": "user", "content": content}],
        "inferenceConfig": {"maxTokens": max_tokens, "temperature": 0.3},
    }
    if system.strip():
        body["system"] = [{"text": system}]

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        resp = await client.post(_runtime_url(model_id, action="converse"), headers=_headers(), json=body)
        if resp.status_code >= 400:
            raise RuntimeError(f"Bedrock converse {resp.status_code}: {resp.text[:200]}")
        data = resp.json()

    parts: list[str] = []
    for block in (data.get("output") or {}).get("message", {}).get("content") or []:
        if isinstance(block, dict) and block.get("text"):
            parts.append(str(block["text"]))
    return "".join(parts).strip()


async def _mantle_vision(
    model_id: str,
    *,
    system: str,
    user_text: str,
    image_bytes: bytes | None,
    mime: str,
    max_tokens: int,
) -> str:
    content: list[dict[str, Any]] = []
    if image_bytes:
        b64 = base64.b64encode(image_bytes).decode("ascii")
        content.append({"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}})
    content.append({"type": "text", "text": user_text})

    messages: list[dict[str, Any]] = []
    if system.strip():
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": content})

    data = await _mantle_post(
        "/chat/completions",
        {"model": model_id, "messages": messages, "max_tokens": max_tokens, "temperature": 0.3},
    )
    choice = (data.get("choices") or [{}])[0]
    return str((choice.get("message") or {}).get("content") or "").strip()


async def converse(
    model_id: str,
    *,
    system: str,
    user_text: str,
    image_bytes: bytes | None = None,
    mime: str = "image/jpeg",
    max_tokens: int = 800,
) -> str:
    settings = get_settings()
    mantle_model = settings.bedrock_mantle_vision_model or model_id
    errors: list[str] = []
    try:
        return await _mantle_vision(
            mantle_model,
            system=system,
            user_text=user_text,
            image_bytes=image_bytes,
            mime=mime,
            max_tokens=max_tokens,
        )
    except Exception as exc:
        errors.append(f"mantle:{exc}")
        log.warning("bedrock.mantle_vision_failed", error=str(exc)[:200])
    try:
        return await _runtime_converse(
            model_id,
            system=system,
            user_text=user_text,
            image_bytes=image_bytes,
            mime=mime,
            max_tokens=max_tokens,
        )
    except Exception as exc:
        errors.append(f"runtime:{exc}")
    raise RuntimeError("; ".join(errors))


async def embed_text(text: str, *, dim: int) -> list[float]:
    settings = get_settings()
    model_id = settings.bedrock_embedding_model

    try:
        data = await _mantle_post(
            "/embeddings",
            {"model": model_id, "input": text, "dimensions": dim},
        )
        row = (data.get("data") or [{}])[0]
        vec = list(row.get("embedding") or [])
        if len(vec) == dim:
            return vec
    except Exception as exc:
        log.warning("bedrock.mantle_embed_failed", error=str(exc)[:200])

    body: dict[str, Any] = {"inputText": text, "dimensions": dim, "normalize": True}
    data = await invoke_model(model_id, body)
    vec = list(data.get("embedding") or [])
    if len(vec) != dim:
        raise ValueError(f"embedding dim mismatch: expected {dim}, got {len(vec)}")
    return vec


async def _runtime_image(prompt: str, model_id: str) -> tuple[bytes, str, str]:
    global _runtime_image_denied
    try:
        data = await invoke_model(model_id, _image_invoke_body(model_id, prompt), timeout=_IMAGE_TIMEOUT)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code in (400, 403, 404):
            _runtime_image_denied = True
        raise
    images = data.get("images") or []
    if not images:
        reason = data.get("finish_reasons") or data.get("error")
        raise RuntimeError(f"{model_id}: no images ({reason})")
    raw = base64.b64decode(images[0])
    return raw, "image/png", model_id


async def generate_image(prompt: str, *, model_id: str | None = None) -> tuple[bytes, str, str]:
    """Return (bytes, mime, model_used). Tries Runtime Stability/Titan models in order."""
    global _runtime_image_denied
    if _runtime_image_denied:
        raise RuntimeError("bedrock_image_access_denied")

    settings = get_settings()
    if not settings.bedrock_image_probe:
        raise RuntimeError("bedrock_image_probe_disabled")
    primary = (model_id or settings.bedrock_image_model or "").strip()
    models = [primary, *[m for m in settings.bedrock_image_fallback_models if m and m != primary]]
    models = [m for m in models if m]
    if not models:
        raise RuntimeError("No bedrock image model configured")

    errors: list[str] = []
    for mid in models:
        try:
            return await _runtime_image(prompt, mid)
        except Exception as exc:
            short = re.sub(r"\s+", " ", str(exc))[:180]
            errors.append(f"{mid}: {short}")
            log.warning("bedrock_runtime.image_failed", model=mid, error=short)

    hint = (
        "AWS Console → Bedrock → Model access: Stability Image Core etkinleştirin. "
        "Mantle anahtarı yalnızca metin chat içindir; görseller bedrock-runtime invoke gerektirir."
    )
    raise RuntimeError(f"{'; '.join(errors)}. {hint}")
