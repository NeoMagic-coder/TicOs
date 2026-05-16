from __future__ import annotations

from fastapi import APIRouter, HTTPException

from apps.api.agents.registry import get_agent_registry
from apps.api.models.schemas import AgentSpec
from apps.api.services.task_store import get_agent_stat_store

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("", response_model=list[AgentSpec])
async def list_agents() -> list[AgentSpec]:
    specs = get_agent_registry().specs()
    stats_map = get_agent_stat_store().all_stats()
    return [
        spec.model_copy(update={"stats": stats_map[spec.agent_id]})
        if spec.agent_id in stats_map
        else spec
        for spec in specs
    ]


@router.get("/{agent_id}", response_model=AgentSpec)
async def get_agent(agent_id: str) -> AgentSpec:
    agent = get_agent_registry().get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} not found")
    return agent.spec.model_copy(update={"stats": get_agent_stat_store().get_stats(agent_id)})
