"""Tool execution engine with permission scoping, validation, retry, fallback, cost tracking."""
from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

from apps.api.core.logging import get_logger
from apps.api.core.observability import (
    TOOL_COST_USD,
    TOOL_DURATION,
    TOOL_INVOCATIONS,
    get_tracer,
)
from apps.api.core.openclaw.mock_router import mock_response
from apps.api.core.openclaw.registry import ToolRegistry, get_registry
from apps.api.core.openclaw.validator import ToolValidationError, validate_payload
from apps.api.models.schemas import ToolCallLog, ToolExecutionResult, ToolManifest
from apps.api.services.tool_stat_store import get_tool_stat_store

log = get_logger(__name__)

LiveAdapter = Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]
_LIVE_ADAPTERS: dict[str, LiveAdapter] = {}


def register_live_adapter(tool_id: str, adapter: LiveAdapter) -> None:
    _LIVE_ADAPTERS[tool_id] = adapter


class PermissionDenied(Exception):
    pass


class ToolNotFound(Exception):
    pass


@dataclass
class ExecutionContext:
    agent_id: str
    task_id: str | None = None
    audit: list[ToolCallLog] = field(default_factory=list)
    budget_usd: float | None = None
    cost_so_far_usd: float = 0.0


class OpenClawExecutor:
    def __init__(self, registry: ToolRegistry | None = None) -> None:
        self.registry = registry or get_registry()

    async def execute(
        self,
        *,
        tool_id: str,
        agent_id: str,
        payload: dict[str, Any] | None = None,
        ctx: ExecutionContext | None = None,
    ) -> ToolExecutionResult:
        payload = payload or {}
        ctx = ctx or ExecutionContext(agent_id=agent_id)

        tool = self.registry.get(tool_id)
        if tool is None:
            raise ToolNotFound(f"Unknown tool: {tool_id}")

        if not self.registry.is_allowed(tool_id, agent_id):
            log.warning("openclaw.permission_denied", tool_id=tool_id, agent_id=agent_id)
            raise PermissionDenied(f"{agent_id} not authorized for {tool_id}")

        try:
            validate_payload(payload, tool.input_schema)
        except ToolValidationError as exc:
            log.warning("openclaw.input_invalid", tool_id=tool_id, error=str(exc), path=exc.path)
            return ToolExecutionResult(
                tool_id=tool_id, status="failure", duration_ms=0, error=f"Invalid input: {exc}"
            )

        if ctx.budget_usd is not None and ctx.cost_so_far_usd + tool.cost_estimate_usd > ctx.budget_usd:
            log.warning("openclaw.budget_exceeded", tool_id=tool_id, budget=ctx.budget_usd)
            return ToolExecutionResult(
                tool_id=tool_id, status="failure", duration_ms=0, error="Budget exceeded"
            )

        tracer = get_tracer()
        with tracer.start_as_current_span(f"tool.{tool_id}") as span:
            span.set_attribute("tool.id", tool_id)
            span.set_attribute("agent.id", agent_id)
            span.set_attribute("tool.mode", tool.mode.value)
            result = await self._run_with_retry(tool, payload, ctx)
            span.set_attribute("tool.status", result.status)
            span.set_attribute("tool.duration_ms", result.duration_ms)
            span.set_attribute("tool.cost_usd", result.cost_usd)

        TOOL_INVOCATIONS.labels(
            tool_id=tool_id, agent_id=agent_id, status=result.status
        ).inc()
        TOOL_DURATION.labels(tool_id=tool_id, status=result.status).observe(
            result.duration_ms / 1000.0
        )
        if result.cost_usd > 0:
            TOOL_COST_USD.labels(tool_id=tool_id).observe(result.cost_usd)

        ctx.audit.append(
            ToolCallLog(
                tool_id=tool_id,
                agent_id=agent_id,
                task_id=ctx.task_id or "",
                duration_ms=result.duration_ms,
                status=result.status,
                cost_usd=result.cost_usd,
                input=payload,
                output=result.output,
            )
        )
        ctx.cost_so_far_usd += result.cost_usd
        get_tool_stat_store().record(
            tool_id,
            status=result.status,
            duration_ms=result.duration_ms,
            cost_usd=result.cost_usd,
        )
        return result

    async def _run_with_retry(
        self, tool: ToolManifest, payload: dict[str, Any], ctx: ExecutionContext
    ) -> ToolExecutionResult:
        attempts = 0
        max_attempts = 2
        last_error: str | None = None
        start = time.monotonic()

        while attempts < max_attempts:
            attempts += 1
            try:
                output = await asyncio.wait_for(
                    self._invoke(tool, payload), timeout=tool.timeout_ms / 1000
                )
                dur = int((time.monotonic() - start) * 1000)
                degraded = bool(output.get("degraded")) if isinstance(output, dict) else False
                degraded_reason = output.get("degraded_reason") if degraded and isinstance(output, dict) else None
                return ToolExecutionResult(
                    tool_id=tool.tool_id,
                    status="success",
                    duration_ms=dur,
                    cost_usd=tool.cost_estimate_usd,
                    output=output,
                    degraded=degraded,
                    degraded_reason=degraded_reason,
                )
            except asyncio.TimeoutError:
                last_error = "timeout"
                log.warning("openclaw.timeout", tool_id=tool.tool_id, attempt=attempts)
            except Exception as exc:
                last_error = str(exc)
                log.warning("openclaw.error", tool_id=tool.tool_id, attempt=attempts, error=last_error)

        if tool.fallback_tool_id:
            log.info("openclaw.fallback", from_tool=tool.tool_id, to=tool.fallback_tool_id)
            fb = self.registry.get(tool.fallback_tool_id)
            if fb is not None:
                output = await self._invoke(fb, payload)
                dur = int((time.monotonic() - start) * 1000)
                return ToolExecutionResult(
                    tool_id=tool.tool_id, status="fallback_used", duration_ms=dur,
                    cost_usd=fb.cost_estimate_usd, output=output,
                )

        dur = int((time.monotonic() - start) * 1000)
        return ToolExecutionResult(
            tool_id=tool.tool_id,
            status="timeout" if last_error == "timeout" else "failure",
            duration_ms=dur,
            error=last_error,
        )

    async def _invoke(self, tool: ToolManifest, payload: dict[str, Any]) -> dict[str, Any]:
        if tool.mode.value == "mock":
            await asyncio.sleep(0.05)
            return mock_response(tool, payload)
        adapter = _LIVE_ADAPTERS.get(tool.tool_id)
        if adapter is None:
            raise NotImplementedError(f"Live adapter for {tool.tool_id} not registered")
        return await adapter(payload)


_executor: OpenClawExecutor | None = None


def get_executor() -> OpenClawExecutor:
    global _executor
    if _executor is None:
        _executor = OpenClawExecutor()
    return _executor
