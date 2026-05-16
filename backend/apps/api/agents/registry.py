"""Registry that wires AgentSpec → concrete BaseAgent class instances."""
from __future__ import annotations

from apps.api.agents.base import BaseAgent
from apps.api.agents.seed import SEED_AGENTS
from apps.api.agents.specialized import agent_class_for
from apps.api.core.logging import get_logger
from apps.api.models.schemas import AgentSpec

log = get_logger(__name__)


class AgentRegistry:
    def __init__(self) -> None:
        self._agents: dict[str, BaseAgent] = {}
        self._load_seed()

    def _load_seed(self) -> None:
        for spec in SEED_AGENTS:
            self.register(spec)
        log.info("agents.registry.loaded", count=len(self._agents))

    def register(self, spec: AgentSpec) -> None:
        cls = agent_class_for(spec.agent_id)
        self._agents[spec.agent_id] = cls(spec)

    def get(self, agent_id: str) -> BaseAgent | None:
        return self._agents.get(agent_id)

    def all(self) -> list[BaseAgent]:
        return list(self._agents.values())

    def specs(self) -> list[AgentSpec]:
        return [a.spec for a in self._agents.values()]


_registry: AgentRegistry | None = None


def get_agent_registry() -> AgentRegistry:
    global _registry
    if _registry is None:
        _registry = AgentRegistry()
    return _registry
