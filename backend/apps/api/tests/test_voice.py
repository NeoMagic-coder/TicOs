"""Tests for the voice WebSocket route — intent detection + dispatch + WS flow."""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from apps.api.routes.voice import detect_intent


@pytest.mark.parametrize(
    "text, intent, contains",
    [
        ("fiyatları %3 düşür", "pricing_adjust", {"direction": "down", "pct": 3}),
        ("fiyatları yüzde 5 artır", "pricing_adjust", {"direction": "up", "pct": 5}),
        ("yeni marka oluştur", "regenerate_brand", {}),
        ("trendyola listele şu ürünü", "trendyol_list", {}),
        ("tüm bekleyen onayları onayla", "approve_all", {}),
        ("olumsuz yorumlara yanıt hazırla", "draft_review_responses", {}),
    ],
)
def test_detect_intent_matches(text: str, intent: str, contains: dict) -> None:
    match = detect_intent(text)
    assert match is not None, f"no match for {text!r}"
    assert match["intent"] == intent
    for k, v in contains.items():
        assert match["params"].get(k) == v


def test_detect_intent_misses() -> None:
    assert detect_intent("") is None
    assert detect_intent("hava bugün nasıl") is None


def test_voice_ws_text_path_dispatches(monkeypatch: pytest.MonkeyPatch) -> None:
    """End-to-end WS flow using a stubbed orchestrator."""
    from apps.api import main as main_module
    from apps.api.routes import voice as voice_module

    class _StubResult:
        summary = "Test özeti"
        task_id = "task_test"
        confidence = 0.9

    class _StubOrchestrator:
        async def handle(self, *, message, history, product_context):
            return _StubResult()

    monkeypatch.setattr(voice_module, "get_orchestrator", lambda: _StubOrchestrator())

    client = TestClient(main_module.app)
    with client.websocket_connect("/ws/voice") as ws:
        ws.send_text(json.dumps({"event": "start"}))
        assert ws.receive_json() == {"event": "ready"}
        ws.send_text(json.dumps({"event": "text", "text": "fiyatları %3 düşür"}))

        events = [ws.receive_json() for _ in range(3)]
        kinds = [e["event"] for e in events]
        assert kinds == ["transcript", "intent", "result"]
        assert events[1]["intent"] == "pricing_adjust"
        assert events[2]["status"] == "ok"
        assert events[2]["summary"] == "Test özeti"


def test_voice_ws_unrecognised_text_escalates() -> None:
    from apps.api import main as main_module

    client = TestClient(main_module.app)
    with client.websocket_connect("/ws/voice") as ws:
        ws.send_text(json.dumps({"event": "text", "text": "alakasız bir cümle"}))
        assert ws.receive_json()["event"] == "transcript"
        result = ws.receive_json()
        assert result["event"] == "result"
        assert result["status"] == "escalated"
