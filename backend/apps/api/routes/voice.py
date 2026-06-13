"""Voice WebSocket endpoint — text intent bridge (Bedrock-backed orchestrator).

``WS /ws/voice`` accepts audio chunks or direct text commands, runs Turkish
intent detection, and dispatches matched intents to the Hermes orchestrator
(Bedrock LLM). Live audio transcription requires Gemini Live and is skipped
when only ``AWS_BEARER_TOKEN_BEDROCK`` is configured — use ``{"event":"text"}``
or browser SpeechRecognition as a stopgap.

Wire format (client → server)
    Binary frame: raw PCM bytes (16 kHz, mono, s16le).
    Text frame  : JSON, one of
        {"event": "start"}
        {"event": "audio", "data": "<base64 PCM>"}
        {"event": "text",  "text": "fiyatları %3 düşür"}
        {"event": "end"}

Wire format (server → client)
    All JSON. ``{"event": "transcript", "text": "..."}``,
    ``{"event": "intent",     "intent": "...", "params": {...}}``,
    ``{"event": "result",     "status": "ok"|"escalated", "summary": "..."}``,
    ``{"event": "error",      "message": "..."}``.
"""
from __future__ import annotations

import asyncio
import base64
import json
import re
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from apps.api.core.hermes.orchestrator import get_orchestrator
from apps.api.core.llm.provider import MockProvider, get_llm_provider
from apps.api.core.logging import get_logger

router = APIRouter(tags=["voice"])
log = get_logger(__name__)

_GEMINI_LIVE_MODEL = "gemini-2.0-flash-live-001"


# ─── Intent detection (Python port of the frontend Turkish substring matcher) ──

_INTENTS: list[tuple[re.Pattern[str], str, dict[str, Any] | None]] = [
    (re.compile(r"\bmarka\b.*(oluştur|olustur|üret|uret|yenile|yeniden)", re.I), "regenerate_brand", None),
    (re.compile(r"trendyol.*(listele|listeleme|yükle|yukle|gönder|gonder)", re.I), "trendyol_list", None),
    (re.compile(r"(tüm|tum|hepsi|bekleyen).*onay.*(onayla|kabul)", re.I), "approve_all", None),
    (re.compile(r"(olumsuz|negatif|tüm|tum).*yorum.*(yanıt|yanit|cevap)", re.I), "draft_review_responses", None),
]


def detect_intent(text: str) -> dict[str, Any] | None:
    """Port of ``frontend/src/stores/useStore.ts::detectIntent`` covering the
    voice-relevant subset. Returns ``{"intent": str, "params": dict}`` or
    ``None``."""
    if not text:
        return None
    if "fiyat" in text.casefold():
        direction = None
        if re.search(r"(düş|dus|indir|azalt)", text, re.I):
            direction = "down"
        elif re.search(r"(art|yüksel|yuksel|zam)", text, re.I):
            direction = "up"
        if direction:
            pct_match = re.search(r"(?:%|yüzde\s*)?(\d+)", text, re.I)
            params: dict[str, Any] = {"direction": direction}
            if pct_match:
                params["pct"] = int(pct_match.group(1))
            return {"intent": "pricing_adjust", "params": params}
    for pattern, intent, base in _INTENTS:
        m = pattern.search(text)
        if not m:
            continue
        params: dict[str, Any] = dict(base or {})
        # Capture a trailing numeric group as ``pct`` when present.
        groups = [g for g in m.groups() if g and g.isdigit()]
        if groups:
            params["pct"] = int(groups[-1])
        return {"intent": intent, "params": params}
    return None


# ─── Intent → orchestrator dispatch ───────────────────────────────────────────

_INTENT_PROMPTS: dict[str, str] = {
    "pricing_adjust": "Tüm SKU fiyatlarını {direction} yönde %{pct} oranında ayarla ve gerekli onayları hazırla.",
    "regenerate_brand": "Marka kimliğini yeniden oluştur: isim, palet, ton ve görsel önerileri üret.",
    "trendyol_list": "Mevcut ürünü Trendyol'a listele; başlık, açıklama ve kategori önerisini hazırla.",
    "approve_all": "Bekleyen tüm onayları gözden geçirip onayla.",
    "draft_review_responses": "Olumsuz tüm yorumlara empatik, profesyonel yanıt taslakları hazırla.",
}


async def dispatch_intent(intent: str, params: dict[str, Any]) -> dict[str, Any]:
    template = _INTENT_PROMPTS.get(intent)
    if template is None:
        return {"status": "escalated", "summary": f"Bilinmeyen intent: {intent}"}
    # ``str.format`` ignores missing keys via SafeDict-style fallback.
    safe = {"direction": params.get("direction", "down"), "pct": params.get("pct", 0)}
    message = template.format(**safe)
    orch = get_orchestrator()
    result = await orch.handle(message=message, history=[], product_context=None)
    return {
        "status": "escalated" if (result.confidence or 0) < 0.5 else "ok",
        "summary": result.summary,
        "task_id": result.task_id,
        "confidence": result.confidence,
    }


# ─── Gemini Live bridge ───────────────────────────────────────────────────────


async def _gemini_live_transcribe(audio_chunks: list[bytes]) -> str:
    """Stream queued PCM chunks to Gemini Live and return the transcript.

    Returns "" if no transcript could be obtained. Falls back gracefully
    when running under MockProvider or when the SDK isn't installed."""
    if isinstance(get_llm_provider(), MockProvider) or not audio_chunks:
        return ""
    try:
        from google import genai  # type: ignore
        from google.genai import types  # type: ignore
    except ImportError:
        return ""

    from apps.api.core.config import get_settings
    api_key = get_settings().gemini_api_key
    if not api_key:
        return ""

    client = genai.Client(api_key=api_key, http_options={"api_version": "v1alpha"})
    config = types.LiveConnectConfig(
        response_modalities=["TEXT"],
        input_audio_transcription=types.AudioTranscriptionConfig(),
    )
    transcript_parts: list[str] = []
    try:
        async with client.aio.live.connect(model=_GEMINI_LIVE_MODEL, config=config) as session:
            for chunk in audio_chunks:
                await session.send_realtime_input(
                    audio=types.Blob(data=chunk, mime_type="audio/pcm;rate=16000")
                )
            await session.send_realtime_input(audio_stream_end=True)
            async for response in session.receive():
                if response.server_content and response.server_content.input_transcription:
                    text = response.server_content.input_transcription.text or ""
                    if text:
                        transcript_parts.append(text)
                if response.server_content and response.server_content.turn_complete:
                    break
    except Exception as exc:
        log.warning("voice.gemini_live.failed", error=str(exc)[:200])
        return ""
    return "".join(transcript_parts).strip()


# ─── WebSocket endpoint ───────────────────────────────────────────────────────


@router.websocket("/ws/voice")
async def voice_socket(ws: WebSocket) -> None:
    await ws.accept()
    audio_buffer: list[bytes] = []
    try:
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                break

            transcript: str | None = None

            if (data := msg.get("bytes")) is not None:
                audio_buffer.append(data)
                continue

            text = msg.get("text")
            if not text:
                continue

            try:
                envelope = json.loads(text)
            except json.JSONDecodeError:
                await ws.send_json({"event": "error", "message": "invalid_json"})
                continue

            event = envelope.get("event")
            if event == "start":
                audio_buffer.clear()
                await ws.send_json({"event": "ready"})
                continue
            if event == "audio":
                try:
                    audio_buffer.append(base64.b64decode(envelope.get("data", "")))
                except Exception:
                    await ws.send_json({"event": "error", "message": "bad_audio"})
                continue
            if event == "text":
                transcript = (envelope.get("text") or "").strip()
            elif event == "end":
                transcript = await _gemini_live_transcribe(audio_buffer)
                audio_buffer.clear()
                if not transcript:
                    # MockProvider / no-key path: simulate from any accumulated
                    # text payload would have been handled above. Nothing to do.
                    await ws.send_json({
                        "event": "result",
                        "status": "escalated",
                        "summary": "Ses tanınamadı (mock mod veya boş ses).",
                    })
                    continue
            else:
                continue

            if transcript is None:
                continue

            await ws.send_json({"event": "transcript", "text": transcript})

            match = detect_intent(transcript)
            if match is None:
                await ws.send_json({
                    "event": "result",
                    "status": "escalated",
                    "summary": "Komut anlaşılamadı.",
                })
                continue

            await ws.send_json({"event": "intent", **match})
            try:
                outcome = await dispatch_intent(match["intent"], match.get("params") or {})
            except Exception as exc:
                log.exception("voice.dispatch.failed")
                await ws.send_json({"event": "error", "message": str(exc)[:200]})
                continue
            await ws.send_json({"event": "result", **outcome})

    except WebSocketDisconnect:
        return
    except Exception as exc:
        log.exception("voice.socket.failed")
        try:
            await ws.send_json({"event": "error", "message": str(exc)[:200]})
        except Exception:
            pass
