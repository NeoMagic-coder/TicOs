from __future__ import annotations

from fastapi import APIRouter, HTTPException

from apps.api.core.openclaw.executor import (
    PermissionDenied, ToolNotFound, _LIVE_ADAPTERS, get_executor,
)
from apps.api.core.openclaw.registry import get_registry
from apps.api.models.schemas import ToolExecutionRequest, ToolExecutionResult, ToolManifest

router = APIRouter(prefix="/tools", tags=["tools"])


@router.get("", response_model=list[ToolManifest])
async def list_tools(category: str | None = None, agent_id: str | None = None) -> list[ToolManifest]:
    reg = get_registry()
    return reg.search(category=category, agent_id=agent_id)


@router.get("/{tool_id}", response_model=ToolManifest)
async def get_tool(tool_id: str) -> ToolManifest:
    tool = get_registry().get(tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool {tool_id} not found")
    return tool


@router.get("/{tool_id}/health")
async def tool_health(tool_id: str) -> dict:
    """Health check for a tool. For mock tools returns mode info; for live
    tools verifies the adapter is registered. Does NOT actually invoke the
    tool — that would have side effects."""
    tool = get_registry().get(tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail=f"Tool {tool_id} not found")
    mode = getattr(tool, "mode", "mock")
    adapter_registered = tool_id in _LIVE_ADAPTERS
    if mode == "live":
        status = "ok" if adapter_registered else "degraded"
        reason = (
            "Live adapter registered."
            if adapter_registered
            else "Live mode but no adapter registered — will fail at runtime."
        )
    else:
        status = "ok"
        reason = "Mock mode — synthetic responses."
    return {
        "tool_id": tool_id,
        "mode": mode,
        "status": status,
        "adapter_registered": adapter_registered,
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
