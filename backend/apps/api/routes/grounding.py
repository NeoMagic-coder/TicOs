"""External Search API for Gemini grounding (Vertex AI / Gemini Enterprise).

POST /api/v1/grounding/search?key=<API_KEY>
    Body:  {"query": "..."}
    Reply: [{"snippet": "...", "uri": "..."}, ...]

The shape follows Google's "Grounding with your search API" spec
(``api_spec: "SIMPLE_SEARCH"``): Gemini calls this endpoint with a search
query and expects a JSON **array** of objects (not a wrapped envelope). Each
object must have a ``snippet`` (text) and ``uri`` (URL/identifier).

This implementation aggregates Turkish marketplace listings via CollectAPI's
``/shopping/search``. When CollectAPI is unsubscribed or down, we still emit
a valid (possibly empty) array so Gemini falls back to its own knowledge
gracefully instead of erroring.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from apps.api.core.config import get_settings
from apps.api.core.logging import get_logger
from apps.api.core.openclaw.executor import ExecutionContext, get_executor
from apps.api.tools.live.web_search import _live as _web_search_live

router = APIRouter(prefix="/grounding", tags=["grounding"])
log = get_logger(__name__)


class GroundingQuery(BaseModel):
    query: str = Field(min_length=1, max_length=512)


def _verify_key(key: str | None) -> None:
    expected = get_settings().grounding_external_api_key
    # When no key is configured the endpoint is open (dev convenience).
    if not expected:
        return
    if key != expected:
        raise HTTPException(status_code=401, detail="invalid grounding api key")


def _format_snippet(item: dict[str, Any]) -> str:
    """Compress a CollectAPI listing into a single grounding-friendly sentence."""
    name = (item.get("name") or item.get("desc") or "").strip()
    desc = (item.get("desc") or "").strip()
    price = (item.get("newprice") or item.get("price") or "").strip()
    seller = (item.get("seller") or "").strip()
    parts: list[str] = []
    if name:
        parts.append(name)
    if desc and desc != name:
        parts.append(desc)
    if price:
        parts.append(f"Fiyat: {price}")
    if seller:
        parts.append(f"Satıcı: {seller}")
    return " — ".join(parts) or "Bilgi yok"


@router.post("/search", response_model=list[dict[str, str]])
async def grounding_search(
    body: GroundingQuery,
    key: str | None = Query(default=None),
    source: str = Query(default="trendyol"),
    limit: int = Query(default=8, ge=1, le=20),
) -> list[dict[str, str]]:
    """Search Turkish marketplaces for ``query`` and return Gemini-grounding
    rows.

    Matches the **SIMPLE_SEARCH** shape Gemini's ``ExternalApi`` retrieval tool
    expects: bare JSON array of ``{snippet, uri}``.
    """
    _verify_key(key)

    executor = get_executor()
    ctx = ExecutionContext(
        agent_id="market_research_agent", task_id=None, budget_usd=0.01
    )
    try:
        result = await executor.execute(
            tool_id="collectapi_shopping_search",
            agent_id="market_research_agent",
            payload={"query": body.query, "source": source, "limit": limit},
            ctx=ctx,
        )
    except Exception as exc:
        log.warning("grounding.search.error", error=str(exc))
        # Spec says: empty array when no results — never raise.
        return []

    output = result.output or {}
    items: list[dict[str, Any]] = list(output.get("results") or [])
    rows: list[dict[str, str]] = []
    for item in items:
        link = (item.get("link") or item.get("url") or "").strip()
        rows.append({"snippet": _format_snippet(item), "uri": link or body.query})
    log.info(
        "grounding.search.served",
        query=body.query,
        source=source,
        count=len(rows),
        tool_status=result.status,
    )
    return rows


class GroundedAnswerRequest(BaseModel):
    query: str = Field(min_length=1, max_length=1000)
    max_tokens: int = Field(default=800, ge=128, le=4096)


class GroundedAnswerSource(BaseModel):
    uri: str
    title: str


class GroundedAnswerResponse(BaseModel):
    answer: str
    queries: list[str]
    sources: list[GroundedAnswerSource]
    model: str
    degraded: bool
    degraded_reason: str | None = None


@router.post("/answer", response_model=GroundedAnswerResponse)
async def grounding_answer(body: GroundedAnswerRequest) -> GroundedAnswerResponse:
    """Answer ``query`` using Gemini's built-in ``googleSearch`` tool.

    Surfaces the search queries Gemini issued and the cited source URIs so
    the UI can render citations. When no real LLM is configured (or the
    breaker is open) the response is the deterministic mock with
    ``degraded: true``.
    """
    result = await _web_search_live(
        {"query": body.query, "max_tokens": body.max_tokens}
    )
    log.info(
        "grounding.answer.served",
        query=body.query,
        sources=len(result.get("sources") or []),
        degraded=bool(result.get("degraded")),
    )
    return GroundedAnswerResponse(**result)
