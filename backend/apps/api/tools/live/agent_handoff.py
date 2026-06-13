"""``agent_handoff`` live adapter.

Bir ajanın başka ajana standart mesaj zarfı ile iş devretmesini sağlar.
Mesaj :class:`MessageBus`'a yayınlanır; aboneler intent veya hedef ajan
üzerinden filtreler. ``max_hops`` (varsayılan 5) ile döngü kırılır.

Diğer compute_tools gibi ``with_breaker`` ile sarılır — pratikte bus
in-process olduğu için breaker nadiren açılır, fakat telemetry shape
uniform kalsın diye wrapper aynen kullanılır.
"""
from __future__ import annotations

from typing import Any

from apps.api.core.logging import get_logger
from apps.api.core.messaging import AgentMessage, MessageBusError, get_message_bus
from apps.api.core.openclaw.breaker import with_breaker
from apps.api.core.openclaw.executor import register_live_adapter

log = get_logger(__name__)

MAX_HOPS = 5
TOOL_ID = "agent_handoff"


async def _agent_handoff(payload: dict[str, Any]) -> dict[str, Any]:
    """Bus'a mesaj yayınla.

    ``from_agent``, ``correlation_id`` ve ``source_node_id`` alanları OpenClaw
    executor tarafından ``ExecutionContext``'ten otomatik enjekte edilir.
    """
    hop = int(payload.get("hop") or 0)
    if hop >= MAX_HOPS:
        log.warning("messaging.max_hops_exceeded", hop=hop, correlation_id=payload.get("correlation_id"))
        return {
            "status": "failure",
            "reason": "max_hops_exceeded",
            "hop": hop,
            "correlation_id": payload.get("correlation_id"),
        }

    kwargs: dict[str, Any] = {
        "from_agent": str(payload.get("from_agent") or "unknown"),
        "to_agent": payload.get("to_agent"),
        "intent": str(payload.get("intent") or ""),
        "payload": dict(payload.get("payload") or {}),
        "hop": hop + 1,
    }
    if payload.get("correlation_id"):
        kwargs["correlation_id"] = str(payload["correlation_id"])
    if payload.get("goal_id") is not None:
        kwargs["goal_id"] = int(payload["goal_id"])

    try:
        msg = AgentMessage(**kwargs)
    except MessageBusError as exc:
        return {"status": "failure", "reason": str(exc), "hop": hop}
    except KeyError as exc:
        return {"status": "failure", "reason": f"missing_field:{exc.args[0]}", "hop": hop}

    bus = get_message_bus()
    delivered = await bus.publish(msg)
    return {
        "status": "ok",
        "message_id": msg.id,
        "correlation_id": msg.correlation_id,
        "delivered_to": delivered,
        "hop": msg.hop,
    }


async def _no_op_mock(_payload: dict[str, Any]) -> dict[str, Any]:
    return {"degraded": True, "degraded_reason": "breaker_open", "status": "failure"}


def register() -> None:
    register_live_adapter(
        TOOL_ID,
        with_breaker(tool_id=TOOL_ID, adapter=_agent_handoff, mock_fallback=_no_op_mock),
    )
    log.info("live.agent_handoff.registered")
