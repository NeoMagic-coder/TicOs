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
from apps.api.core.autonomy.negotiation import (
    carrier_negotiation,
    influencer_fee_negotiation,
    supplier_rfq,
)
from apps.api.core.autonomy.decision_engine import (
    HybridPricingPolicy,
    PricingSignal,
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


# ---------------------- Negotiation Templates (Sprint 3-A) ------------------


def test_supplier_rfq_agreement_within_zopa():
    state, summary = supplier_rfq(
        current_cogs=100.0,
        target_cogs=80.0,
        floor_price=75.0,
    )
    assert state.outcome == "agreement"
    assert state.final_price is not None
    assert 75.0 <= state.final_price <= state.buyer_walk_away
    assert "Tedarikçi anlaşması" in summary


def test_supplier_rfq_walk_away_when_floor_above_budget():
    # floor_price > buyer_walk_away (current_cogs*1.05) → no ZOPA
    state, summary = supplier_rfq(
        current_cogs=100.0,
        target_cogs=80.0,
        floor_price=110.0,  # seller won't go below 110, buyer max ~105
    )
    assert state.outcome == "walk_away"
    assert state.final_price is None
    assert "walk-away" in summary.lower() or "anlaşma sağlanamadı" in summary


def test_influencer_fee_agreement():
    state, summary = influencer_fee_negotiation(
        budget_per_post=1_000.0,
        quoted_fee=1_200.0,
        min_acceptable_fee=900.0,
    )
    # buyer_walk_away=1300, seller_walk_away=900 → ZOPA exists
    assert state.outcome == "agreement"
    assert state.final_price is not None
    assert "Influencer anlaşması" in summary


def test_influencer_fee_walk_away():
    state, summary = influencer_fee_negotiation(
        budget_per_post=500.0,
        quoted_fee=2_000.0,
        min_acceptable_fee=1_800.0,
    )
    # buyer_walk_away=650, seller_walk_away=1800 → no ZOPA
    assert state.outcome == "walk_away"


def test_carrier_negotiation_aggressive_style():
    # current=9, target=7 → initial gap=2; converges in round 5 with ratio=0.18
    state, summary = carrier_negotiation(
        current_rate_per_kg=9.0,
        target_rate_per_kg=7.0,
        floor_rate_per_kg=6.0,
    )
    assert state.outcome == "agreement"
    assert "Kargo anlaşması" in summary
    assert state.style == "aggressive"


def test_carrier_negotiation_no_zopa():
    state, summary = carrier_negotiation(
        current_rate_per_kg=5.0,
        target_rate_per_kg=2.0,
        floor_rate_per_kg=8.0,  # seller floor > buyer ceiling
    )
    assert state.outcome == "walk_away"


# --------------------- HybridPricingPolicy (Sprint 3-B) --------------------


def test_hybrid_policy_roas_below_threshold_cuts_budget():
    policy = HybridPricingPolicy(roas_cut_threshold=1.5)
    signal = PricingSignal(
        current_price=100.0, roas=1.2,
        competitor_price=95.0, margin_pct=0.30,
    )
    decision = policy.decide(signal)
    assert decision.action == "cut_budget"
    assert decision.source == "rule"
    assert decision.change_pct == 0.0
    assert decision.new_price == 100.0


def test_hybrid_policy_margin_at_floor_holds():
    policy = HybridPricingPolicy()
    signal = PricingSignal(
        current_price=100.0, roas=2.0,
        competitor_price=90.0, margin_pct=0.22, min_margin_pct=0.22,
    )
    decision = policy.decide(signal)
    assert decision.action == "hold"
    assert decision.source == "rule"


def test_hybrid_policy_bandit_selects_arm_deterministically():
    # seed=0 → reproducible arm selection
    policy = HybridPricingPolicy(epsilon=0.0, seed=0)  # greedy only
    signal = PricingSignal(
        current_price=200.0, roas=3.0,
        competitor_price=190.0, margin_pct=0.35,
    )
    d1 = policy.decide(signal)
    policy2 = HybridPricingPolicy(epsilon=0.0, seed=0)
    d2 = policy2.decide(signal)
    # Same seed, same greedy selection → same result
    assert d1.arm_idx == d2.arm_idx
    assert d1.change_pct == d2.change_pct


def test_hybrid_policy_bandit_adjust_within_limit():
    # Force arm 4 (+1.5%) via epsilon=0 and initialise that arm with highest reward
    policy = HybridPricingPolicy(epsilon=0.0, seed=42)
    policy.arms[4].update(0.5)  # arm idx 4 = +1.5%
    signal = PricingSignal(
        current_price=100.0, roas=2.5,
        competitor_price=98.0, margin_pct=0.35,
    )
    decision = policy.decide(signal)
    assert decision.action == "adjust"
    assert decision.source == "bandit"
    assert decision.arm_idx is not None


def test_hybrid_policy_over_limit_arm_needs_approval():
    # Create a policy where max is 3%, but arm has +5% change
    policy = HybridPricingPolicy(
        epsilon=0.0, max_price_change_pct=3.0, seed=1,
        arms=[5.0],  # only one arm, always selected
    )
    signal = PricingSignal(
        current_price=100.0, roas=2.0,
        competitor_price=95.0, margin_pct=0.40,
    )
    decision = policy.decide(signal)
    assert decision.action == "needs_approval"
    assert decision.change_pct == 5.0


def test_hybrid_policy_update_affects_avg_reward():
    policy = HybridPricingPolicy()
    assert policy.arms[0].avg_reward == 0.0
    policy.update(0, 0.8)
    policy.update(0, 0.6)
    assert abs(policy.arms[0].avg_reward - 0.7) < 1e-9
    assert policy.arms[0].n_pulls == 2
