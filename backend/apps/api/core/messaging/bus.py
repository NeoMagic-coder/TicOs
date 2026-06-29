"""In-process agent-to-agent message bus."""
from __future__ import annotations

import uuid
from collections import deque
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Awaitable, Callable

from apps.api.core.logging import get_logger

log = get_logger(__name__)

VALID_INTENTS = frozenset({
    "request_data",
    "notify_event",
    "delegate_subtask",
    "negotiate_offer",
})

Handler = Callable[["AgentMessage"], Awaitable[None]]


class MessageBusError(ValueError):
    """Raised when a message envelope is invalid."""


@dataclass
class AgentMessage:
    from_agent: str
    intent: str
    payload: dict[str, Any]
    to_agent: str | None = None
    correlation_id: str = ""
    goal_id: int | None = None
    hop: int = 0
    id: str = field(default_factory=lambda: f"msg_{uuid.uuid4().hex[:12]}")
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    def __post_init__(self) -> None:
        if not self.from_agent:
            raise MessageBusError("from_agent is required")
        if self.intent not in VALID_INTENTS:
            raise MessageBusError(f"invalid intent: {self.intent}")
        if not self.correlation_id:
            self.correlation_id = f"corr_{uuid.uuid4().hex[:12]}"


@dataclass
class _Subscription:
    handler: Handler
    agent_id: str | None = None
    intent: str | None = None


class MessageBus:
    def __init__(self) -> None:
        self._subscriptions: list[_Subscription] = []
        self._history: deque[AgentMessage] = deque(maxlen=500)

    def subscribe(
        self,
        handler: Handler,
        *,
        agent_id: str | None = None,
        intent: str | None = None,
    ) -> None:
        self._subscriptions.append(_Subscription(handler=handler, agent_id=agent_id, intent=intent))

    async def publish(self, message: AgentMessage) -> int:
        self._history.append(message)
        delivered = 0
        for sub in self._subscriptions:
            if sub.intent is not None and message.intent != sub.intent:
                continue
            if sub.agent_id is not None and message.to_agent != sub.agent_id:
                continue
            try:
                await sub.handler(message)
                delivered += 1
            except Exception as exc:
                log.warning(
                    "messaging.handler_failed",
                    message_id=message.id,
                    error=str(exc)[:200],
                )
        log.info(
            "messaging.published",
            message_id=message.id,
            intent=message.intent,
            delivered=delivered,
        )
        return delivered

    def history(
        self,
        *,
        correlation_id: str | None = None,
        agent_id: str | None = None,
    ) -> list[AgentMessage]:
        rows = list(self._history)
        if correlation_id is not None:
            rows = [m for m in rows if m.correlation_id == correlation_id]
        if agent_id is not None:
            rows = [m for m in rows if m.to_agent == agent_id or m.from_agent == agent_id]
        return rows

    def reset(self) -> None:
        self._subscriptions.clear()
        self._history.clear()


_BUS = MessageBus()


def get_message_bus() -> MessageBus:
    return _BUS
