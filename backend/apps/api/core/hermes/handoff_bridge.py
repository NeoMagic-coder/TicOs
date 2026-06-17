"""Runtime bridge: ``agent_handoff`` bus messages → live TaskGraph injection (Faz 1.5)."""
from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from apps.api.agents.registry import AgentRegistry
from apps.api.core.hermes.task_graph import TaskGraph
from apps.api.core.logging import get_logger
from apps.api.core.messaging import AgentMessage, get_message_bus

log = get_logger(__name__)

EventSink = Callable[[dict[str, Any]], Awaitable[None]]


class HandoffBridge:
    """Subscribes to the process MessageBus for the duration of one Hermes run."""

    def __init__(
        self,
        *,
        graph: TaskGraph,
        task_id: str,
        agents: AgentRegistry,
        emit: EventSink | None = None,
    ) -> None:
        self.graph = graph
        self.task_id = task_id
        self.agents = agents
        self.emit = emit
        self._active = False
        self.injected_node_ids: list[str] = []

    async def _handler(self, msg: AgentMessage) -> None:
        if not self._active:
            return
        if msg.intent != "delegate_subtask":
            return
        if msg.correlation_id and msg.correlation_id != self.task_id:
            return

        to_agent = msg.to_agent
        if not to_agent:
            log.warning("handoff.missing_to_agent", message_id=msg.id, task_id=self.task_id)
            return
        if self.agents.get(to_agent) is None:
            log.warning("handoff.unknown_agent", to_agent=to_agent, task_id=self.task_id)
            return

        source_node_id = str(msg.payload.get("source_node_id") or "")
        if not source_node_id or source_node_id not in self.graph.nodes:
            log.warning(
                "handoff.invalid_source",
                source=source_node_id,
                task_id=self.task_id,
                message_id=msg.id,
            )
            return

        title = str(
            msg.payload.get("title")
            or (msg.payload.get("message") or "")[:120]
            or f"Devredilen: {to_agent}"
        )
        node_payload: dict[str, Any] = {
            "message": str(msg.payload.get("message") or msg.payload.get("task") or title),
            "handoff_from": msg.from_agent,
            "handoff_message_id": msg.id,
            "source": "agent_handoff",
        }
        for key, value in msg.payload.items():
            if key not in {"source_node_id", "title"}:
                node_payload.setdefault(key, value)

        node = self.graph.inject_handoff(
            from_node_id=source_node_id,
            to_agent=to_agent,
            title=title,
            payload=node_payload,
        )
        if node is None:
            return

        self.injected_node_ids.append(node.node_id)
        log.info(
            "handoff.node_injected",
            task_id=self.task_id,
            node_id=node.node_id,
            to_agent=to_agent,
            from_node=source_node_id,
        )
        if self.emit is not None:
            await self.emit(
                "node_injected",
                node_id=node.node_id,
                agent_id=to_agent,
                title=title,
                from_agent=msg.from_agent,
                from_node_id=source_node_id,
            )

    def activate(self) -> None:
        if self._active:
            return
        self._active = True
        get_message_bus().subscribe(self._handler, intent="delegate_subtask")

    def deactivate(self) -> None:
        self._active = False
