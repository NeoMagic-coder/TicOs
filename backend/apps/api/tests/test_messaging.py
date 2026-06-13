from __future__ import annotations

import asyncio

import pytest

from apps.api.core.messaging import AgentMessage, MessageBus, MessageBusError, get_message_bus
from apps.api.core.openclaw.executor import ExecutionContext, OpenClawExecutor
from apps.api.core.hermes.handoff_bridge import HandoffBridge
from apps.api.core.hermes.task_graph import TaskGraph, TaskNode
from apps.api.agents.registry import get_agent_registry
from apps.api.tools.live.agent_handoff import MAX_HOPS, register as register_handoff


@pytest.fixture(autouse=True)
def _reset_global_bus():
    get_message_bus().reset()
    yield
    get_message_bus().reset()


@pytest.fixture
def bus() -> MessageBus:
    """Her test izole bir bus alır; global singleton sızıntısını engeller."""
    return MessageBus()


@pytest.mark.asyncio
async def test_publish_fanout_matches_subscribers(bus: MessageBus):
    received: list[AgentMessage] = []

    async def handler(msg: AgentMessage) -> None:
        received.append(msg)

    bus.subscribe(handler, intent="notify_event")
    msg = AgentMessage(
        from_agent="dynamic_pricing_agent",
        to_agent="logistics_agent",
        intent="notify_event",
        payload={"sku": "SKU-1", "delta_pct": -8.0},
    )
    delivered = await bus.publish(msg)
    assert delivered == 1
    assert received[0].payload["sku"] == "SKU-1"


@pytest.mark.asyncio
async def test_subscribe_filter_by_agent(bus: MessageBus):
    seen: list[str] = []

    async def only_logistics(msg: AgentMessage) -> None:
        seen.append(msg.id)

    bus.subscribe(only_logistics, agent_id="logistics_agent")
    await bus.publish(AgentMessage(from_agent="a", to_agent="logistics_agent",
                                   intent="request_data", payload={}))
    await bus.publish(AgentMessage(from_agent="a", to_agent="finance_agent",
                                   intent="request_data", payload={}))
    assert len(seen) == 1


@pytest.mark.asyncio
async def test_history_by_correlation(bus: MessageBus):
    cid = "corr-xyz"
    for i in range(3):
        await bus.publish(AgentMessage(
            from_agent="a", to_agent="b",
            intent="delegate_subtask", payload={"i": i},
            correlation_id=cid,
        ))
    # Diğer zincir bulaşmasın
    await bus.publish(AgentMessage(from_agent="a", to_agent="b",
                                   intent="notify_event", payload={}))
    chain = bus.history(correlation_id=cid)
    assert len(chain) == 3
    assert [m.payload["i"] for m in chain] == [0, 1, 2]


def test_invalid_intent_raises():
    with pytest.raises(MessageBusError):
        AgentMessage(from_agent="x", intent="garbage", payload={})


def test_empty_from_agent_raises():
    with pytest.raises(MessageBusError):
        AgentMessage(from_agent="", intent="notify_event", payload={})


@pytest.mark.asyncio
async def test_handler_exception_does_not_break_others(bus: MessageBus):
    other_called = asyncio.Event()

    async def bad(_msg: AgentMessage) -> None:
        raise RuntimeError("boom")

    async def good(_msg: AgentMessage) -> None:
        other_called.set()

    bus.subscribe(bad, intent="notify_event")
    bus.subscribe(good, intent="notify_event")
    await bus.publish(AgentMessage(from_agent="a", intent="notify_event", payload={}))
    assert other_called.is_set()


@pytest.mark.asyncio
async def test_agent_handoff_tool_via_executor():
    """Tool manifest'ten executor üzerinden çağrılabiliyor mu — permission +
    schema validation + adapter execution end-to-end."""
    register_handoff()  # idempotent — adapter map'i overwrite eder
    executor = OpenClawExecutor()
    ctx = ExecutionContext(agent_id="dynamic_pricing_agent", task_id="t-handoff")
    result = await executor.execute(
        tool_id="agent_handoff",
        agent_id="dynamic_pricing_agent",
        payload={
            "to_agent": "logistics_agent",
            "intent": "notify_event",
            "payload": {"sku": "SKU-9", "delta_pct": -5.0},
        },
        ctx=ctx,
    )
    assert result.status == "success"
    assert result.output["status"] == "ok"
    assert result.output["hop"] == 1
    assert result.output["correlation_id"] == "t-handoff"
    assert len(ctx.audit) == 1
    assert ctx.audit[0].input.get("from_agent") == "dynamic_pricing_agent"
    assert ctx.audit[0].input.get("correlation_id") == "t-handoff"


@pytest.mark.asyncio
async def test_agent_handoff_max_hops_kill_switch():
    register_handoff()
    executor = OpenClawExecutor()
    result = await executor.execute(
        tool_id="agent_handoff",
        agent_id="autonomous_decision_agent",
        payload={
            "from_agent": "autonomous_decision_agent",
            "to_agent": "logistics_agent",
            "intent": "delegate_subtask",
            "payload": {},
            "hop": MAX_HOPS,  # bir sonraki publish yasak olmalı
        },
    )
    # Adapter "failure" döndü; executor bunu success-with-failure-output olarak
    # gösterebilir, ama biz adapter çıktısının semantiğini doğrularız.
    assert result.output.get("status") == "failure"
    assert result.output.get("reason") == "max_hops_exceeded"


@pytest.mark.asyncio
async def test_coordination_bus_relays_to_a2a():
    from apps.api.core.autonomy.coordination import CoordinationBus, CoordinationMessage
    from apps.api.core.messaging.coordination_bridge import wire_coordination_to_a2a

    received: list[AgentMessage] = []

    async def handler(msg: AgentMessage) -> None:
        received.append(msg)

    bus = CoordinationBus()
    wire_coordination_to_a2a(bus)
    get_message_bus().subscribe(handler, intent="delegate_subtask")

    await bus.publish(
        CoordinationMessage(
            sender="marketplace_router",
            recipient="logistics_agent",
            topic="delegate_subtask",
            payload={"order_id": "ORD-1"},
            correlation_id="corr_ops",
        )
    )
    assert len(received) == 1
    assert received[0].from_agent == "marketplace_router"
    assert received[0].to_agent == "logistics_agent"
    assert received[0].intent == "delegate_subtask"
    assert received[0].correlation_id == "corr_ops"


@pytest.mark.asyncio
async def test_handoff_bridge_injects_delegate_subtask_node():
    graph = TaskGraph(root_task_id="task_abc")
    parent = graph.add(TaskNode.new(title="Primary", agent_id="dynamic_pricing_agent"))
    parent.status = "running"

    events: list[str] = []

    async def emit(event: str, **_: object) -> None:
        events.append(event)

    bridge = HandoffBridge(
        graph=graph,
        task_id="task_abc",
        agents=get_agent_registry(),
        emit=emit,
    )
    bridge.activate()
    try:
        await get_message_bus().publish(
            AgentMessage(
                from_agent="dynamic_pricing_agent",
                to_agent="logistics_agent",
                intent="delegate_subtask",
                correlation_id="task_abc",
                payload={
                    "source_node_id": parent.node_id,
                    "message": "Stok hareketini izle",
                    "title": "Lojistik takip",
                },
            )
        )
    finally:
        bridge.deactivate()

    assert len(graph.nodes) == 2
    assert len(bridge.injected_node_ids) == 1
    assert events == ["node_injected"]
    injected = graph.nodes[bridge.injected_node_ids[0]]
    assert injected.agent_id == "logistics_agent"
    assert parent.node_id in injected.depends_on
