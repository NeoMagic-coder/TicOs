"""Voice note transcription — converts audio URLs to text via Gemini Audio API."""
from __future__ import annotations

import base64

import httpx

from apps.api.core.llm.provider import LLMMessage, get_llm_provider
from apps.api.core.logging import get_logger

log = get_logger(__name__)

_TRANSCRIBE_PROMPT = (
    "Transcribe this audio exactly as spoken. "
    "If the language is Turkish, keep it in Turkish. "
    "Return ONLY the transcription — no comments, no labels."
)


async def transcribe(audio_url: str) -> str:
    """Download an audio file and transcribe it with Gemini.

    Falls back to a placeholder if Gemini Audio is unavailable.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(audio_url)
        resp.raise_for_status()
        audio_b64 = base64.b64encode(resp.content).decode()

    content_type = resp.headers.get("content-type", "audio/ogg").split(";")[0].strip()

    llm = get_llm_provider()
    # Gemini supports inline audio via parts. We pass a multimodal message.
    # If the provider is MockProvider it will return the prompt text — handled gracefully.
    messages = [
        LLMMessage(
            role="user",
            content=[
                {"type": "text", "text": _TRANSCRIBE_PROMPT},
                {"type": "inline_data", "mime_type": content_type, "data": audio_b64},
            ],
        )
    ]
    try:
        resp_obj = await llm.complete(messages)
        text = (resp_obj.content or "").strip()
        if text:
            log.info("gateway.transcribed", chars=len(text))
            return text
    except Exception as exc:
        log.warning("gateway.transcribe_llm_failed", error=str(exc)[:120])

    return "[ses notu — transkripsiyon başarısız]"
