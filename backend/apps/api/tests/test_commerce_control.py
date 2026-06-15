"""Tests for Commerce Control Layer."""
from __future__ import annotations

from apps.api.core.commerce.analyzers import analyze_fraud, run_all_analyzers
from apps.api.core.commerce.action_registry import propose_action
from apps.api.core.commerce.orchestrator import CommerceControlOrchestrator


def test_run_all_analyzers_returns_six_modules() -> None:
    modules = run_all_analyzers()
    ids = {m["module_id"] for m in modules}
    assert ids == {"products", "stock", "orders", "payment", "support", "fraud"}


def test_commerce_orchestrator_scan_shape() -> None:
    snap = CommerceControlOrchestrator().scan()
    assert "overall_health" in snap
    assert "modules" in snap
    assert len(snap["modules"]) == 6
    assert "limitations" in snap
    assert len(snap["limitations"]) >= 3


def test_analyze_fraud_has_disclaimer_recommendation() -> None:
    mod = analyze_fraud()
    assert mod["module_id"] == "fraud"
    assert mod["ai_technique"] == "anomaly_detection,behavioral_scoring"
    assert isinstance(mod["recommendations"], list)


def test_propose_low_risk_action() -> None:
    result = propose_action(
        action_type="suggest_restock",
        module_id="stock",
        params={"product_id": "test"},
        confidence=0.9,
        risk_level="low",
    )
    assert result["decision_status"] in ("auto_approved", "needs_approved", "needs_approval", "rejected")
    assert result["action_type"] == "suggest_restock"
