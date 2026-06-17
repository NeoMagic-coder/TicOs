"""Tests for the ``web_search_grounded`` live adapter.

We never reach Gemini — instead the LLM provider singleton is replaced with
a stub that mimics the relevant slice of ``LLMResponse`` (``text``, ``raw``,
``error``, ``model``). Cases covered:

- happy path: grounded answer + queries + sources surface intact
- mock-mode short-circuit: ``MockProvider`` → deterministic mock envelope
- LLM error: degrades gracefully with a ``degraded_reason``
- no grounding metadata: ``degraded=True`` even when text is present
- empty query: validates payload up-front
"""
from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass, field
from typing import Any

import pytest

from apps.api.core.llm import provider as llm_provider_mod
from apps.api.core.llm.provider import GeminiProvider, LLMMessage, MockProvider, get_llm_provider
from apps.api.tools.live import web_search


@dataclass
class _StubResponse:
    text: str
    error: str | None = None
    model: str = "stub"
    tokens_used: int = 0
    raw: dict[str, Any] = field(default_factory=dict)


class _StubProvider:
    """Captures the ``grounding`` arg so we can assert it was forwarded."""

    def __init__(
        self,
        *,
        text: str = "",
        raw: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        self.text = text
        self.raw = raw or {}
        self.error = error
        self.last_grounding: list[str] | None = None

    async def generate(self, *, system, messages, temperature=0.0, max_tokens=512, grounding=None):
        self.last_grounding = grounding
        return _StubResponse(text=self.text, raw=self.raw, error=self.error)


class _GeminiStub(GeminiProvider):
    """Gemini yolu testleri icin — google_search grounding beklenir."""

    def __init__(
        self,
        *,
        text: str = "",
        raw: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        self.text = text
        self.raw = raw or {}
        self.error = error
        self.last_grounding: list[str] | None = None

    async def generate(self, *, system, messages, temperature=0.0, max_tokens=512, grounding=None):
        self.last_grounding = grounding
        return _StubResponse(text=self.text, raw=self.raw, error=self.error)


class _BedrockStub(_StubProvider):
    """Bedrock yolu testleri icin — harici web aramasi mock'lanir."""


@pytest.fixture
def reset_provider() -> Iterator[None]:
    orig = llm_provider_mod._provider
    llm_provider_mod._provider = None
    yield
    llm_provider_mod._provider = orig


def _install(provider) -> None:
    llm_provider_mod._provider = provider


# ── happy path ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_returns_grounded_answer(reset_provider: None) -> None:
    stub = _GeminiStub(
        text="Türkiye nüfusu yaklaşık 85,4 milyon.",
        raw={
            "grounding_metadata": {
                "queries": ["Türkiye nüfusu 2026"],
                "sources": [{"uri": "https://tuik.gov.tr/x", "title": "TÜİK"}],
            },
        },
    )
    _install(stub)

    out = await web_search._live({"query": "Türkiye nüfusu nedir?"})

    assert out["answer"].startswith("Türkiye nüfusu")
    assert out["queries"] == ["Türkiye nüfusu 2026"]
    assert out["sources"] == [{"uri": "https://tuik.gov.tr/x", "title": "TÜİK"}]
    assert out["degraded"] is False
    assert out["degraded_reason"] is None
    # Crucially: the adapter must request googleSearch grounding from the provider.
    assert stub.last_grounding == ["google_search"]


# ── mock-mode short-circuit ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_mock_provider_short_circuits(reset_provider: None) -> None:
    _install(MockProvider())
    out = await web_search._live({"query": "anything"})
    assert out["degraded"] is True
    assert out["degraded_reason"] == "no_api_key_or_breaker"
    assert out["sources"] == []
    assert out["queries"] == []


# ── LLM error ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_llm_error_degrades(reset_provider: None) -> None:
    _install(_GeminiStub(text="", error="Gemini 500"))
    out = await web_search._live({"query": "test"})
    assert out["degraded"] is True
    assert "Gemini 500" in (out["degraded_reason"] or "")


# ── no grounding metadata ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_no_grounding_metadata_marks_degraded(reset_provider: None) -> None:
    # Provider returns text but no grounding_metadata block — adapter should
    # surface the answer but flag it as degraded so the UI doesn't claim
    # citations that don't exist.
    _install(_GeminiStub(text="Cevap", raw={}))
    out = await web_search._live({"query": "test"})
    assert out["answer"] == "Cevap"
    assert out["degraded"] is True
    assert out["degraded_reason"] == "no_grounding_metadata"


@pytest.mark.asyncio
async def test_bedrock_path_uses_external_search(
    reset_provider: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    stub = _BedrockStub(text="Bedrock ozeti.")
    _install(stub)

    async def _fake_external(query: str):
        return [query], [{"uri": "https://example.com/p", "title": "Ornek", "snippet": "fiyat 100"}]

    monkeypatch.setattr(web_search, "_external_search", _fake_external)
    out = await web_search._live({"query": "kulaklik fiyat"})
    assert out["answer"] == "Bedrock ozeti."
    assert out["sources"] == [{"uri": "https://example.com/p", "title": "Ornek"}]
    assert out["degraded"] is False


# ── empty query ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_empty_query_is_validated(reset_provider: None) -> None:
    # No provider call should happen for an empty query.
    stub = _StubProvider(text="should not be used")
    _install(stub)
    out = await web_search._live({"query": "   "})
    assert out["degraded"] is True
    assert out["degraded_reason"] == "empty_query"
    assert stub.last_grounding is None
