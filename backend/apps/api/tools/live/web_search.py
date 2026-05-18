"""Google Search-grounded LLM tool.

Wraps Gemini's built-in ``googleSearch`` tool: the LLM provider runs the
model with ``grounding=["google_search"]`` so Gemini executes a live
web search before answering, then ``_extract_grounding_metadata`` (in
``apps/api/core/llm/provider.py``) normalizes the
``candidates[0].groundingMetadata`` envelope into ``{queries, sources}``.

This adapter just calls the provider, surfaces that metadata, and
degrades gracefully when no real LLM is available or the breaker is
open.

Output shape::

    {
      "answer":  str,                              # grounded Turkish answer
      "queries": [str, ...],                       # Google searches issued
      "sources": [{"uri": str, "title": str}, ...],
      "model":   str,
      "degraded": bool,
      "degraded_reason": str | None
    }
"""
from __future__ import annotations

from typing import Any

from apps.api.core.llm.provider import LLMMessage, MockProvider, get_llm_provider
from apps.api.core.logging import get_logger
from apps.api.core.openclaw.breaker import with_breaker
from apps.api.core.openclaw.executor import register_live_adapter

log = get_logger(__name__)

_SYSTEM_PROMPT = (
    "Sen Türkçe konuşan bir araştırma asistanısın. Verilen soruyu Google "
    "araması ile doğrulayarak güncel, kaynaklı bilgi sun. Cevabı 2-4 "
    "cümleyle özet halinde Türkçe ver; tarih/sayı varsa kaynaktan al."
)


def _mock(payload: dict[str, Any]) -> dict[str, Any]:
    """Deterministic fallback used when no LLM is configured or the breaker
    is open. Same shape as the live response so callers don't need to branch."""
    query = str(payload.get("query") or "").strip()
    return {
        "answer": (
            f"(mock) '{query[:80]}' için canlı arama yapılamadı — "
            "GEMINI_API_KEY ayarlayın."
        ),
        "queries": [],
        "sources": [],
        "model": "mock",
        "degraded": True,
        "degraded_reason": "no_api_key_or_breaker",
    }


async def _live(payload: dict[str, Any]) -> dict[str, Any]:
    query = str(payload.get("query") or "").strip()[:1000]
    if not query:
        return {
            "answer": "",
            "queries": [],
            "sources": [],
            "model": "",
            "degraded": True,
            "degraded_reason": "empty_query",
        }

    provider = get_llm_provider()
    # Short-circuit when there is no real LLM — skipping the network call
    # keeps mock-mode latency predictable.
    if isinstance(provider, MockProvider):
        return _mock(payload)

    try:
        resp = await provider.generate(
            system=_SYSTEM_PROMPT,
            messages=[LLMMessage(role="user", content=query)],
            temperature=0.3,
            max_tokens=int(payload.get("max_tokens") or 800),
            grounding=["google_search"],
        )
    except Exception as exc:
        log.warning("web_search_grounded.exception", error=str(exc)[:200])
        return {**_mock(payload), "degraded_reason": "llm_exception"}

    if resp.error and not resp.text:
        return {**_mock(payload), "degraded_reason": (resp.error or "")[:200]}

    meta = (resp.raw or {}).get("grounding_metadata") or {}
    queries = [str(q) for q in (meta.get("queries") or [])]
    sources = [
        {"uri": str(s.get("uri") or ""), "title": str(s.get("title") or s.get("uri") or "")}
        for s in (meta.get("sources") or [])
        if isinstance(s, dict) and s.get("uri")
    ]
    grounded = bool(queries or sources)
    return {
        "answer": resp.text,
        "queries": queries,
        "sources": sources,
        "model": resp.model or "",
        "degraded": not grounded,
        "degraded_reason": None if grounded else "no_grounding_metadata",
    }


def register() -> None:
    register_live_adapter(
        "web_search_grounded",
        with_breaker(
            tool_id="web_search_grounded",
            adapter=_live,
            mock_fallback=_mock,
        ),
    )
    log.info("live.web_search_grounded.registered")
