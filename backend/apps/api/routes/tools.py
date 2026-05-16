from __future__ import annotations

from fastapi import APIRouter, HTTPException

from apps.api.core.openclaw import breaker as breaker_mod
from apps.api.core.openclaw.executor import (
    PermissionDenied, ToolNotFound, _LIVE_ADAPTERS, get_executor,
)
from apps.api.core.openclaw.registry import get_registry
from apps.api.models.schemas import ToolExecutionRequest, ToolExecutionResult, ToolManifest
from apps.api.services.tool_stat_store import get_tool_stat_store

router = APIRouter(prefix="/tools", tags=["tools"])


def _enrich(tool: ToolManifest) -> ToolManifest:
    stats = get_tool_stat_store().get_stats(tool.tool_id)
    last = breaker_mod.last_status.get(tool.tool_id)
    update: dict = {"stats": stats}
    if last is not None:
        update["degraded"] = bool(last.get("degraded"))
        update["degraded_reason"] = last.get("reason")
    return tool.model_copy(update=update)


@router.get("", response_model=list[ToolManifest])
async def list_tools(category: str | None = None, agent_id: str | None = None) -> list[ToolManifest]:
    reg = get_registry()
    return [_enrich(t) for t in reg.search(category=category, agent_id=agent_id)]


@router.get("/{tool_id}", response_model=ToolManifest)
async def get_tool(tool_id: str) -> ToolManifest:
    tool = get_registry().get(tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool {tool_id} not found")
    return _enrich(tool)


@router.get("/{tool_id}/health")
async def tool_health(tool_id: str) -> dict:
    """Health check for a tool. For mock tools returns mode info; for live
    tools verifies the adapter is registered AND reports the last observed
    runtime status from the circuit breaker. Does NOT actually invoke the
    tool — that would have side effects."""
    tool = get_registry().get(tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool {tool_id} not found")
    mode = getattr(tool, "mode", "mock")
    if hasattr(mode, "value"):
        mode = mode.value
    adapter_registered = tool_id in _LIVE_ADAPTERS
    last = breaker_mod.last_status.get(tool_id)

    if mode == "live":
        if not adapter_registered:
            status = "degraded"
            reason = "Live mode but no adapter registered — will fail at runtime."
        elif last and last.get("degraded"):
            status = "degraded"
            reason = f"Last call fell back to mock ({last.get('reason')})."
        elif last:
            status = "ok"
            reason = "Last live call succeeded."
        else:
            status = "ok"
            reason = "Live adapter registered (no calls yet)."
    else:
        status = "ok"
        reason = "Mock mode — synthetic responses."
    return {
        "tool_id": tool_id,
        "mode": mode,
        "status": status,
        "adapter_registered": adapter_registered,
        "degraded": bool(last and last.get("degraded")),
        "degraded_reason": last.get("reason") if last else None,
        "reason": reason,
    }


@router.post("/execute", response_model=ToolExecutionResult)
async def execute_tool(req: ToolExecutionRequest) -> ToolExecutionResult:
    executor = get_executor()
    try:
        return await executor.execute(
            tool_id=req.tool_id, agent_id=req.agent_id, payload=req.input
        )
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ToolNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
