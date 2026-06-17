"""Mirror :class:`CoordinationBus` publishes onto the A2A :class:`MessageBus`."""
from __future__ import annotations

from apps.api.core.autonomy.coordination import BROADCAST, CoordinationBus, CoordinationMessage
from apps.api.core.logging import get_logger
from apps.api.core.messaging.bus import AgentMessage, MessageBus, get_message_bus

log = get_logger(__name__)

TOPIC_TO_INTENT: dict[str, str] = {
    "delegate_subtask": "delegate_subtask",
    "request_data": "request_data",
    "notify_event": "notify_event",
    "negotiate_offer": "negotiate_offer",
    "dispatch": "notify_event",
    "proposal": "negotiate_offer",
}


def coordination_to_agent_message(msg: CoordinationMessage) -> AgentMessage:
    intent = TOPIC_TO_INTENT.get(msg.topic, "notify_event")
    to_agent = None if msg.recipient == BROADCAST else msg.recipient
    return AgentMessage(
        from_agent=msg.sender,
        to_agent=to_agent,
        intent=intent,
        payload=dict(msg.payload),
        correlation_id=msg.correlation_id,
    )


async def relay_coordination_message(msg: CoordinationMessage) -> int:
    """Publish a coordination envelope onto the A2A bus."""
    a2a = coordination_to_agent_message(msg)
    delivered = await get_message_bus().publish(a2a)
    log.info(
        "messaging.coordination_relayed",
        topic=msg.topic,
        sender=msg.sender,
        recipient=msg.recipient,
        delivered=delivered,
    )
    return delivered


def wire_coordination_to_a2a(
    bus: CoordinationBus,
    *,
    message_bus: MessageBus | None = None,
) -> None:
    """Install a relay so CoordinationBus.publish also hits MessageBus."""
    _ = message_bus or get_message_bus()

    async def _relay(msg: CoordinationMessage) -> None:
        await relay_coordination_message(msg)

    bus.set_relay(_relay)
    log.info("messaging.coordination_bridge.wired")
