"""Multi-agent otonomi katmanı testleri."""
from __future__ import annotations

import asyncio

import pytest

from apps.api.core.autonomy import (
    AgentGoalProfile,
    AutonomyPolicy,
    CoordinationBus,
    CoordinationMessage,
    DecisionEngine,
    NegotiationProtocol,
    NegotiationState,
    reconcile_proposals,
)
from apps.api.core.autonomy.marketplace_router import (
    MarketplaceRouter,
    MarketplaceTarget,
)


# ----------------------------- DecisionEngine ------------------------------


def test_decision_engine_auto_approves_small_price_change():
    engine = DecisionEngine(AutonomyPolicy(max_price_change_pct=5.0, min_confidence=0.7))
    out = engine.evaluate(action_type="price_change_pct", value=3.2, confidence=0.85)
    assert out.status == "auto_approved"


def test_decision_engine_escalates_when_over_limit():
    engine = DecisionEngine(AutonomyPolicy(max_price_change_pct=5.0))
    out = engine.evaluate(action_type="price_change_pct", value=8.0, confidence=0.9)
    assert out.status == "needs_approval"
    assert "limit" in out.reason.lower()


def test_decision_engine_escalates_low_confidence():
    engine = DecisionEngine(AutonomyPolicy(min_confidence=0.8))
    out = engine.evaluate(action_type="carrier_switch_cost_try", value=100, confidence=0.55)
    assert out.status == "needs_approval"


def test_decision_engine_risk_threshold():
    engine = DecisionEngine(AutonomyPolicy(risk_auto_threshold="low"))
    out = engine.evaluate(action_type="price_change_pct", value=1.0, risk_level="high", confidence=0.95)
    assert out.status == "needs_approval"


# ----------------------------- NegotiationProtocol -------------------------


def test_negotiation_reaches_agreement_within_zopa():
    state = NegotiationState(
        buyer_target=40.0, buyer_walk_away=50.0,
        seller_target=55.0, seller_walk_away=42.0,
        style="moderate", max_rounds=8,
    )
    NegotiationProtocol().run(state)
    assert state.outcome == "agreement"
    assert state.final_price is not None
    assert 42.0 <= state.final_price <= 50.0
    assert len(state.rounds) >= 1


def test_negotiation_walk_away_when_no_zopa():
    state = NegotiationState(
        buyer_target=20.0, buyer_walk_away=30.0,
        seller_target=60.0, seller_walk_away=50.0,
    )
    NegotiationProtocol().run(state)
    assert state.outcome == "walk_away"
    assert state.final_price is None


# ----------------------------- CoordinationBus -----------------------------


@pytest.mark.asyncio
async def test_coordination_bus_direct_message():
    bus = CoordinationBus()
    msg = CoordinationMessage(
        sender="pricing_agent", recipient="negotiation_agent",
        topic="price.update", payload={"sku": "X1", "price": 100},
    )
    await bus.publish(msg)
    received = await bus.subscribe("negotiation_agent", timeout=1.0)
    assert received is not None
    assert received.payload["sku"] == "X1"
    assert len(bus.history) == 1


@pytest.mark.asyncio
async def test_coordination_bus_broadcast():
    bus = CoordinationBus()
    # Pre-register iki ajan kuyruğunu
    await bus.publish(CoordinationMessage(
        sender="x", recipient="a", topic="t", payload={},
    ))
    await bus.subscribe("a", timeout=1.0)
    await bus.publish(CoordinationMessage(
        sender="x", recipient="b", topic="t", payload={},
    ))
    await bus.subscribe("b", timeout=1.0)

    await bus.publish(CoordinationMessage(
        sender="supervisor", recipient="*", topic="alert.stock_low",
        payload={"sku": "Z9"},
    ))
    a = await bus.subscribe("a", timeout=1.0)
    b = await bus.subscribe("b", timeout=1.0)
    assert a is not None and b is not None
    assert a.topic == b.topic == "alert.stock_low"


# ----------------------------- Goal Reconciliation -------------------------


def test_reconcile_proposals_picks_highest_weighted_utility():
    proposals = [
        {"proposal_id": "p1", "margin_pct": 35.0, "expected_revenue_lift_pct": 4.0},
        {"proposal_id": "p2", "margin_pct": 28.0, "expected_revenue_lift_pct": 14.0},
    ]
    profiles = [
        AgentGoalProfile(agent_id="pricing_agent", objective="maximize_margin", weight=1.0),
        AgentGoalProfile(agent_id="growth_agent", objective="maximize_revenue", weight=2.0),
    ]
    result = reconcile_proposals(proposals, profiles, strategy="vote")
    assert result.winner is not None
    assert result.winner["proposal_id"] == "p2"


def test_reconcile_proposals_hard_constraint_vetoes():
    proposals = [
        {"proposal_id": "p1", "margin_pct": 12.0},  # marj çok düşük → veto
        {"proposal_id": "p2", "margin_pct": 30.0},
    ]
    profiles = [
        AgentGoalProfile(
            agent_id="pricing_agent", objective="maximize_margin",
            hard_constraints={"min_margin_pct": 22.0},
        ),
    ]
    result = reconcile_proposals(proposals, profiles)
    assert result.winner is not None
    assert result.winner["proposal_id"] == "p2"
    assert "pricing_agent" in result.vetoed_by


# ----------------------------- MarketplaceRouter ---------------------------


@pytest.mark.asyncio
async def test_marketplace_router_collects_and_reconciles():
    bus = CoordinationBus()
    targets = [
        MarketplaceTarget(
            marketplace="trendyol", agent_id="seller_ty",
            profile=AgentGoalProfile(agent_id="seller_ty", objective="maximize_margin"),
        ),
        MarketplaceTarget(
            marketplace="hepsiburada", agent_id="seller_hb",
            profile=AgentGoalProfile(agent_id="seller_hb", objective="maximize_margin"),
        ),
    ]
    router = MarketplaceRouter(bus, targets, response_timeout_s=0.5)

    # Simüle satıcı yanıtları — gerçek dünyada her ajan kendi reply'ını publish ederdi
    async def reply(agent_id: str, margin: float):
        # Router'ın dispatch'inden sonra subscribe için bekleyeceği kuyruğa yaz
        await bus.publish(CoordinationMessage(
            sender=agent_id,
            recipient=f"{router.sender_id}:{agent_id}",
            topic="bid.response",
            payload={"proposal_id": f"{agent_id}_bid", "margin_pct": margin},
        ))

    # Dispatch ve yanıtları paralel yarat
    dispatch_task = asyncio.create_task(router.dispatch(
        topic="bid.request", payload={"sku": "SKU1"},
    ))
    await asyncio.sleep(0)
    await reply("seller_ty", 24.0)
    await reply("seller_hb", 31.0)
    result = await dispatch_task

    assert result.winner is not None
    assert result.winner["proposal_id"] == "seller_hb_bid"
