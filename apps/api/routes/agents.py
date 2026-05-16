from __future__ import annotations

from fastapi import APIRouter, HTTPException

from apps.api.agents.registry import get_agent_registry
from apps.api.models.schemas import AgentSpec

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=list[AgentSpec])
async def list_agents() -> list[AgentSpec]:
    return get_agent_registry().specs()


@router.get("/{agent_id}", response_model=AgentSpec)
async def get_agent(agent_id: str) -> AgentSpec:
    agent = get_agent_registry().get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
    return agent.spec
