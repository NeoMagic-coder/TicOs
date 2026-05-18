"""Chat endpoints.

``POST /chat``         — buffered. Single JSON response after Hermes finishes.
``POST /chat/stream``  — Server-Sent Events. Streams progress events while
                          Hermes runs and finishes with a ``done`` event that
                          carries the same payload shape as ``/chat``.

SSE wire format::

    event: progress
    data: {"event": "agent_started", "agent_id": "pricing_agent", ...}

    event: message
    data: {"event": "done", "content": "...", "task_id": "task_abc", ...}

Browsers can't POST via ``EventSource``; the frontend uses ``fetch`` with a
``ReadableStream`` reader and parses the same wire format. See
``src/lib/api.ts::streamChatBackend``.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from apps.api.core.hermes.orchestrator import get_orchestrator
from apps.api.core.llm.provider import LLMMessage
from apps.api.models.schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/chat", tags=["chat"])


def _enforce_budget(req: ChatRequest) -> None:
    """Refuse the request when this product has burned through its daily
    budget. Cheap pre-flight check — heavy spend gets recorded *after* the
    task completes, so a single in-flight task can still over-run by one
    task's worth of cost. That trade-off is intentional: we don't want to
    pre-reserve budget for unknown work."""
    from fastapi import HTTPException
    from apps.api.core.budget import is_exhausted, remaining
    name = (req.product_context or {}).get("product_name") if isinstance(req.product_context, dict) else None
    if is_exhausted(name):
        rem = remaining(name)
        raise HTTPException(
            status_code=429,
            detail={
                "error": "daily_budget_exhausted",
                "product": name,
                "remaining_usd": rem,
                "message": f"'{name}' için günlük bütçe tükendi. Yarın tekrar deneyin.",
            },
            headers={"Retry-After": "3600"},
        )


@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    _enforce_budget(req)
    orch = get_orchestrator()
    history = [LLMMessage(role=t.role, content=t.content) for t in req.history]
    result = await orch.handle(
        message=req.message,
        history=history,
        product_context=req.product_context,
    )
    # Record realised cost so subsequent tasks see the spend.
    try:
        from apps.api.core.budget import record as _record_spend
        name = (req.product_context or {}).get("product_name") if isinstance(req.product_context, dict) else None
        total = float(getattr(result, "total_cost_usd", 0.0) or sum(
            (o.tools_called and sum(tc.cost_usd for tc in o.tools_called) or 0.0)
            for o in result.agent_outputs
        ))
        _record_spend(name, total)
    except Exception:
        # Budget is best-effort — never break a real response over accounting.
        pass
    degraded, degraded_reason = _llm_degraded_state()
    return ChatResponse(
        content=result.summary,
        task_id=result.task_id,
        confidence=result.confidence,
        tools_used=result.tools_used,
        thinking=(
            f"routing: primary={result.routing.primary_agent}, "
            f"supporting={result.routing.supporting}; "
            f"nodes={result.graph.get('total', 0)}"
        ),
        agent_outputs=result.agent_outputs,
        llm_degraded=degraded,
        llm_degraded_reason=degraded_reason,
    )


def _llm_degraded_state() -> tuple[bool, str | None]:
    """True when the live LLM is unavailable. Two cases:
    - MockProvider is the singleton (no GEMINI_API_KEY).
    - GeminiProvider is configured but the most recent call(s) fell back to
      mock because the quota is exhausted (sticky flag on the provider).
    The UI shows a persistent "Mock LLM" badge in either case."""
    from apps.api.core.llm.provider import GeminiProvider, MockProvider, get_llm_provider
    provider = get_llm_provider()
    if isinstance(provider, MockProvider):
        return True, "no_api_key"
    if isinstance(provider, GeminiProvider) and getattr(provider, "last_call_degraded", False):
        return True, getattr(provider, "last_call_degraded_reason", None) or "gemini_quota_exhausted"
    return False, None


_PROGRESS_EVENTS = {
    "task_started",
    "plan_ready",
    "agent_started",
    "tool_called",
    "critic_scored",
    "agent_retry",
    "agent_completed",
    "agent_failed",
    "merging",
}


def _sse(event: str, data: dict[str, Any]) -> str:
    """Format one SSE frame. ``data:`` must end with a blank line."""
    payload = json.dumps(data, ensure_ascii=False, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


@router.post("/stream")
async def chat_stream(req: ChatRequest) -> StreamingResponse:
    """SSE-streaming counterpart of ``POST /chat``.

    Orchestrator writes progress events into an asyncio.Queue; this generator
    drains the queue and yields SSE frames. A sentinel ``None`` marks the end.
    """
    _enforce_budget(req)
    orch = get_orchestrator()
    history = [LLMMessage(role=t.role, content=t.content) for t in req.history]
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

    async def sink(event: dict[str, Any]) -> None:
        await queue.put(event)

    async def runner() -> None:
        try:
            result = await orch.handle(
                message=req.message,
                history=history,
                product_context=req.product_context,
                event_sink=sink,
            )
            # Final payload mirrors ChatResponse so the client can drop it
            # straight into the chat store without a second request.
            degraded, degraded_reason = _llm_degraded_state()
            final = ChatResponse(
                content=result.summary,
                task_id=result.task_id,
                confidence=result.confidence,
                tools_used=result.tools_used,
                thinking=(
                    f"routing: primary={result.routing.primary_agent}, "
                    f"supporting={result.routing.supporting}; "
                    f"nodes={result.graph.get('total', 0)}"
                ),
                agent_outputs=result.agent_outputs,
                llm_degraded=degraded,
                llm_degraded_reason=degraded_reason,
            )
            await queue.put({"event": "result", "payload": final.model_dump(mode="json")})
        except Exception as exc:
            await queue.put({"event": "error", "error": str(exc)[:400]})
        finally:
            await queue.put(None)

    async def stream():
        task = asyncio.create_task(runner())
        try:
            while True:
                event = await queue.get()
                if event is None:
                    break
                name = event.get("event", "progress")
                if name == "result":
                    yield _sse("message", event["payload"])
                elif name == "error":
                    yield _sse("error", {"error": event["error"]})
                elif name in _PROGRESS_EVENTS:
                    yield _sse("progress", event)
                else:
                    yield _sse("progress", event)
        finally:
            await task

    headers = {
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",  # disable nginx buffering
        "Connection": "keep-alive",
    }
    return StreamingResponse(stream(), media_type="text/event-stream", headers=headers)
