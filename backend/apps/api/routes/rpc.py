"""RPC tool-call endpoint — for scripts and internal processes to call tools directly.

POST /api/v1/rpc/tool
    Execute a single tool as a named agent without going through Hermes.

POST /api/v1/rpc/subagent
    Spawn an isolated sub-agent (non-streaming) and return its output.

GET  /api/v1/rpc/subagents/{parent_task_id}
    List all sub-agent runs for a parent task (audit trail).
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from apps.api.agents.registry import get_agent_registry
from apps.api.core.openclaw.executor import ExecutionContext, PermissionDenied, ToolNotFound, get_executor

router = APIRouter(prefix="/rpc", tags=["rpc"])


class ToolRPCRequest(BaseModel):
    tool_id: str
    agent_id: str
    payload: dict[str, Any] = Field(default_factory=dict)
    task_id: str | None = None
    budget_usd: float | None = None


class SubagentRPCRequest(BaseModel):
    agent_id: str
    message: str
    parent_task_id: str
    budget_usd: float = 0.05
    product_context: dict[str, Any] = Field(default_factory=dict)


@router.post("/tool", response_model=dict[str, Any])
async def rpc_tool(body: ToolRPCRequest) -> dict[str, Any]:
    """Execute a single tool as the specified agent and return the result.

    The agent must have permission for the tool (``allowed_agents`` in manifest).
    A missing or empty ``allowed_agents`` list means all agents are permitted.
    """
    registry = get_agent_registry()
    if not registry.get(body.agent_id):
        raise HTTPException(status_code=422, detail=f"Unknown agent: {body.agent_id!r}")

    executor = get_executor()
    ctx = ExecutionContext(
        agent_id=body.agent_id,
        task_id=body.task_id,
        budget_usd=body.budget_usd,
    )

    try:
        result = await executor.execute(
            tool_id=body.tool_id,
            agent_id=body.agent_id,
            payload=body.payload,
            ctx=ctx,
        )
    except ToolNotFound as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionDenied as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    return {
        "tool_id": result.tool_id,
        "status": result.status,
        "duration_ms": result.duration_ms,
        "cost_usd": result.cost_usd,
        "output": result.output,
        "error": result.error,
    }


@router.post("/subagent", response_model=dict[str, Any])
async def rpc_subagent(body: SubagentRPCRequest) -> dict[str, Any]:
    """Spawn an isolated sub-agent and return its output synchronously."""
    from apps.api.core.hermes.subagent import get_subagent_runner

    runner = get_subagent_runner()
    try:
        output = await runner.run(
            message=body.message,
            agent_id=body.agent_id,
            parent_task_id=body.parent_task_id,
            product_context=body.product_context,
            budget_usd=body.budget_usd,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "agent_id": output.agent_id,
        "status": output.status,
        "summary": output.summary,
        "confidence": output.confidence,
        "tools_used": [t.tool_id for t in (output.tools_called or [])],
    }


@router.get("/subagents/{parent_task_id}", response_model=list[dict[str, Any]])
async def list_subagents(parent_task_id: str) -> list[dict[str, Any]]:
    """Return all sub-agent runs spawned from a parent task."""
    from apps.api.core.hermes.subagent import get_subagent_runner
    return get_subagent_runner().get_runs(parent_task_id)
