"""Tests for the LLM-only live adapters (apps/api/tools/live/llm_tools.py).

We don't reach Gemini — instead the LLM provider singleton is replaced with
a stub that returns canned text per call. Tests cover:

- happy path: structured JSON parsed back into the documented shape
- JSON parse failure: adapter falls through to the deterministic mock and
  marks ``degraded=True``
- mock-mode short-circuit: when the live provider is the MockProvider,
  adapter returns the per-tool fallback without ever calling generate()
- breaker fallback: shared _shared_mock returns degraded envelope
"""
from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass

import pytest

from apps.api.core.llm import provider as llm_provider_mod
from apps.api.tools.live import llm_tools


@dataclass
class _StubResponse:
    text: str
    error: str | None = None
    model: str = "stub"
    tokens_used: int = 0
    raw: dict | None = None


class _StubProvider:
    """Implements just the LLMProvider.generate signature the adapters use."""

    def __init__(self, text: str = "", error: str | None = None) -> None:
        self.text = text
        self.error = error
        self.calls = 0

    async def generate(self, *, system: str, messages, temperature=0.0, max_tokens=512, grounding=None):
        self.calls += 1
        return _StubResponse(text=self.text, error=self.error)


@pytest.fixture
def reset_provider() -> Iterator[None]:
    """Reset the cached LLM provider singleton so each test can install its
    own stub via monkeypatch + get_llm_provider()."""
    orig = llm_provider_mod._provider
    llm_provider_mod._provider = None
    yield
    llm_provider_mod._provider = orig


def _install(provider) -> None:
    llm_provider_mod._provider = provider


# ── happy path ────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_brand_name_generator_parses_llm_json(reset_provider: None) -> None:
    _install(_StubProvider(text='{"names": [{"name": "Lume", "score": 0.9, "rationale": "ok"}]}'))
    out = await llm_tools._brand_name_generator_adapter({"vibe": "minimal"})
    assert out["names"][0]["name"] == "Lume"
    assert out["names"][0]["score"] == 0.9
    assert "degraded" not in out  # real LLM path → no degraded marker


@pytest.mark.asyncio
async def test_sentiment_analyzer_parses_llm_json(reset_provider: None) -> None:
    _install(_StubProvider(text='{"polarity": "pos", "confidence": 0.83, "key_phrases": ["hızlı kargo"]}'))
    out = await llm_tools._sentiment_analyzer_adapter({"text": "Çok memnun kaldım."})
    assert out["polarity"] == "pos"
    assert out["confidence"] == 0.83
    assert out["key_phrases"] == ["hızlı kargo"]


@pytest.mark.asyncio
async def test_review_response_generator_parses_llm_json(reset_provider: None) -> None:
    _install(_StubProvider(text='{"response": "Teşekkürler!", "sentiment": "pos", "requires_followup": false}'))
    out = await llm_tools._review_response_generator_adapter({"text": "Harika ürün"})
    assert out["response"] == "Teşekkürler!"
    assert out["sentiment"] == "pos"
    assert out["requires_followup"] is False


# ── parse-fail fallback ──────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_brand_name_generator_falls_back_on_parse_fail(
    reset_provider: None,
) -> None:
    _install(_StubProvider(text="not json at all"))
    out = await llm_tools._brand_name_generator_adapter({"vibe": "x"})
    assert out["degraded"] is True
    assert out["degraded_reason"] == "json_parse_failed"
    # Shape still intact for downstream consumers:
    assert isinstance(out["names"], list)


@pytest.mark.asyncio
async def test_sentiment_analyzer_handles_fenced_json(reset_provider: None) -> None:
    """Lenient parser must strip ```json ... ``` fences (a common Gemini
    output style despite the "return only JSON" instruction)."""
    _install(_StubProvider(text='```json\n{"polarity": "neg", "confidence": 0.6, "key_phrases": []}\n```'))
    out = await llm_tools._sentiment_analyzer_adapter({"text": "Berbat"})
    assert out["polarity"] == "neg"
    assert out["confidence"] == 0.6


# ── mock-mode short-circuit ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_color_palette_short_circuits_in_mock_mode(reset_provider: None) -> None:
    """When the provider singleton is MockProvider the adapter must NOT call
    generate() — short-circuit straight to the fallback envelope."""
    mp = llm_provider_mod.MockProvider()
    # Spy on generate via a flag mutated in a wrapper.
    called = {"n": 0}
    orig = mp.generate

    async def _spy(**kw):
        called["n"] += 1
        return await orig(**kw)

    mp.generate = _spy  # type: ignore[assignment]
    _install(mp)

    out = await llm_tools._color_palette_generator_adapter({"mood": "warm"})
    assert out["degraded"] is True
    assert out["degraded_reason"] == "no_api_key"
    assert len(out["palette"]) == 5
    assert called["n"] == 0  # short-circuit confirmed


# ── llm exception ────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_draft_reply_handles_llm_exception(reset_provider: None) -> None:
    class _Raiser:
        async def generate(self, **kw):
            raise RuntimeError("Gemini 500")

    _install(_Raiser())
    out = await llm_tools._draft_reply_generator_adapter({"text": "İade istiyorum"})
    assert out["degraded"] is True
    assert out["degraded_reason"] == "llm_exception"
    assert isinstance(out["reply"], str)


# ── breaker fallback envelope ────────────────────────────────────────────

@pytest.mark.asyncio
async def test_shared_mock_returns_degraded_envelope() -> None:
    out = await llm_tools._shared_mock({})
    assert out == {"degraded": True, "degraded_reason": "breaker_open"}
