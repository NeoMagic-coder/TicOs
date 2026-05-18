"""Boundary, property-based, and immutability tests for the autonomy
policy gate. The decision engine is the safety boundary between
autonomous agent actions and irreversible side-effects — these tests
exist to make sure that boundary cannot be drifted accidentally.

Run:
    pytest apps/api/tests/test_autonomy_policy.py -q
"""
from __future__ import annotations

import dataclasses

import pytest
from hypothesis import given, settings, strategies as st

from apps.api.core.autonomy.decision_engine import (
    AutonomyPolicy,
    DecisionEngine,
    DecisionOutcome,
)


# ── Boundary tests: max_price_change_pct = 5.0 ─────────────────────────────


@pytest.fixture
def engine() -> DecisionEngine:
    # Default policy: 5% price change, 0.7 confidence, low risk threshold.
    return DecisionEngine()


@pytest.mark.parametrize(
    "value,expected",
    [
        (0.0, "auto_approved"),
        (4.99, "auto_approved"),
        (5.0, "auto_approved"),       # boundary: inclusive
        (5.000001, "needs_approval"),
        (5.01, "needs_approval"),
        (-4.99, "auto_approved"),
        (-5.0, "auto_approved"),
        (-5.000001, "needs_approval"),  # signed magnitude check
        (100.0, "needs_approval"),
    ],
)
def test_price_change_boundary(engine: DecisionEngine, value: float, expected: str) -> None:
    out = engine.evaluate(
        action_type="price_change_pct",
        value=value,
        risk_level="low",
        confidence=0.9,
    )
    assert out.status == expected, f"value={value} → {out.status} ({out.reason})"


@pytest.mark.parametrize(
    "confidence,expected",
    [
        (0.0, "needs_approval"),
        (0.69, "needs_approval"),
        (0.6999999, "needs_approval"),
        (0.70, "auto_approved"),      # boundary: inclusive
        (0.7000001, "auto_approved"),
        (1.0, "auto_approved"),
    ],
)
def test_confidence_boundary(engine: DecisionEngine, confidence: float, expected: str) -> None:
    out = engine.evaluate(
        action_type="price_change_pct",
        value=2.0,
        risk_level="low",
        confidence=confidence,
    )
    assert out.status == expected, f"conf={confidence} → {out.status} ({out.reason})"


@pytest.mark.parametrize(
    "risk_level,policy_threshold,expected",
    [
        ("low", "low", "auto_approved"),
        ("medium", "low", "needs_approval"),
        ("high", "low", "needs_approval"),
        ("critical", "low", "needs_approval"),
        ("medium", "medium", "auto_approved"),
        ("high", "medium", "needs_approval"),
        ("high", "high", "auto_approved"),
        ("critical", "high", "needs_approval"),
        # Unknown risk levels rank highest → always needs_approval.
        ("unknown_severity", "low", "needs_approval"),
    ],
)
def test_risk_threshold_boundary(
    risk_level: str, policy_threshold: str, expected: str
) -> None:
    eng = DecisionEngine(AutonomyPolicy(risk_auto_threshold=policy_threshold))
    out = eng.evaluate(
        action_type="price_change_pct",
        value=2.0,
        risk_level=risk_level,
        confidence=0.9,
    )
    assert out.status == expected


@pytest.mark.parametrize(
    "value,limit,expected",
    [
        (499.99, 500.0, "auto_approved"),
        (500.0, 500.0, "auto_approved"),
        (500.01, 500.0, "needs_approval"),
        (1_000.0, 500.0, "needs_approval"),
    ],
)
def test_carrier_switch_boundary(value: float, limit: float, expected: str) -> None:
    eng = DecisionEngine(AutonomyPolicy(max_carrier_switch_cost_try=limit))
    out = eng.evaluate(
        action_type="carrier_switch_cost_try",
        value=value,
        risk_level="low",
        confidence=0.9,
    )
    assert out.status == expected


# ── Property-based: policy is never violated under random inputs ────────────


# We want a strong invariant:
#   If status == "auto_approved", THEN every applicable threshold was respected.
# Hypothesis fuzzes the input space (confidence, value, risk, action_type)
# and asserts the invariant holds.

action_types = st.sampled_from([
    "price_change_pct", "carrier_switch_cost_try",
    "negotiation_commit_try", "unknown_action",
])
risk_levels = st.sampled_from(["low", "medium", "high", "critical", "fictional"])


@given(
    action_type=action_types,
    value=st.floats(min_value=-1_000_000, max_value=1_000_000, allow_nan=False, allow_infinity=False),
    risk_level=risk_levels,
    confidence=st.floats(min_value=0.0, max_value=1.0),
)
@settings(max_examples=400, deadline=None)
def test_auto_approve_implies_within_policy(
    action_type: str, value: float, risk_level: str, confidence: float
) -> None:
    policy = AutonomyPolicy()
    out = DecisionEngine(policy).evaluate(
        action_type=action_type,
        value=value,
        risk_level=risk_level,
        confidence=confidence,
    )
    if out.status != "auto_approved":
        return  # vacuously fine — nothing to assert

    # The only path to auto_approved is: confidence>=min, risk<=threshold,
    # and value within its action-specific limit (when known).
    assert confidence >= policy.min_confidence, (
        f"auto_approved with confidence {confidence} < {policy.min_confidence}"
    )
    assert policy.risk_rank(risk_level) <= policy.risk_rank(policy.risk_auto_threshold), (
        f"auto_approved with risk '{risk_level}' over '{policy.risk_auto_threshold}'"
    )
    if action_type == "price_change_pct":
        assert abs(value) <= policy.max_price_change_pct
    elif action_type == "carrier_switch_cost_try":
        assert value <= policy.max_carrier_switch_cost_try
    elif action_type == "negotiation_commit_try":
        assert value <= policy.max_negotiation_walk_away_try
    # Unknown action_types currently have no limit ⇒ engine auto-approves
    # any value. If that policy ever changes, this test will start to
    # catch it (the assertions above become falsifiable).


@given(
    pct=st.floats(min_value=0.01, max_value=100.0, allow_nan=False, allow_infinity=False),
    over_by=st.floats(min_value=0.001, max_value=50.0, allow_nan=False, allow_infinity=False),
)
@settings(max_examples=200, deadline=None)
def test_price_change_above_limit_is_always_escalated(pct: float, over_by: float) -> None:
    """Anything strictly > max_price_change_pct must escalate."""
    policy = AutonomyPolicy(max_price_change_pct=pct)
    out = DecisionEngine(policy).evaluate(
        action_type="price_change_pct",
        value=pct + over_by,
        risk_level="low",
        confidence=1.0,
    )
    assert out.status == "needs_approval"


# ── Immutability: a DecisionOutcome and the policy itself cannot be mutated ─


def test_autonomy_policy_is_frozen() -> None:
    policy = AutonomyPolicy()
    with pytest.raises(dataclasses.FrozenInstanceError):
        policy.max_price_change_pct = 999.0  # type: ignore[misc]


def test_decision_outcome_id_is_unique_and_monotonic() -> None:
    eng = DecisionEngine()
    ids = [
        eng.evaluate(action_type="price_change_pct", value=1.0, confidence=1.0).decision_id
        for _ in range(50)
    ]
    assert len(set(ids)) == 50, "decision_id must be unique"
    # Format: dec_NNNNNN — should sort the same as insertion order.
    assert ids == sorted(ids), "decision_id must be monotonically increasing"


def test_decision_outcome_audit_trail_is_immutable_after_write() -> None:
    """Once captured, a DecisionOutcome's fields should not silently
    change. We simulate the audit-log invariant: keep an immutable copy
    of the original record and verify it's still equal after later
    decisions are produced.
    """
    eng = DecisionEngine()
    first = eng.evaluate(action_type="price_change_pct", value=2.0, confidence=0.95)

    # Snapshot via dataclasses.replace — must equal a verbatim copy.
    snapshot = dataclasses.replace(first)

    # Produce some unrelated decisions to advance internal state.
    for _ in range(10):
        eng.evaluate(action_type="price_change_pct", value=1.0, confidence=0.95)

    # The original captured outcome must be untouched.
    assert first == snapshot
    assert first.decision_id == snapshot.decision_id
    assert first.decided_at == snapshot.decided_at
    assert first.status == snapshot.status
    assert first.reason == snapshot.reason


# ── Regression: high-risk reorder must never auto-approve ───────────────────


def test_high_risk_reorder_never_auto_approved_regardless_of_confidence() -> None:
    """The screenshot/UI shows an 'acil reorder' with risk=high. This is
    the most dangerous false-negative the system can make: silently
    placing an emergency order. Even with confidence 1.0, it must
    escalate while policy.risk_auto_threshold remains 'low' or 'medium'.
    """
    policy = AutonomyPolicy(risk_auto_threshold="medium")
    out = DecisionEngine(policy).evaluate(
        action_type="price_change_pct",  # action type is irrelevant here
        value=0.0,
        risk_level="high",
        confidence=1.0,
    )
    assert out.status == "needs_approval"
    assert "Risk" in out.reason
