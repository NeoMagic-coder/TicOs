"""Commerce control orchestrator — unified snapshot across e-commerce modules."""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from apps.api.core.commerce.action_registry import list_action_types
from apps.api.core.commerce.analyzers import run_all_analyzers
from apps.api.core.commerce.policy import CommerceControlPolicy, get_commerce_policy

_orchestrator: CommerceControlOrchestrator | None = None


class CommerceControlOrchestrator:
    """Aggregates module analyzers and exposes a single control-plane snapshot."""

    def __init__(self, policy: CommerceControlPolicy | None = None) -> None:
        self.policy = policy or get_commerce_policy()
        self._last_scan_at: datetime | None = None
        self._last_snapshot: dict[str, Any] | None = None

    def scan(self) -> dict[str, Any]:
        modules = run_all_analyzers(self.policy)
        overall = sum(m["health_score"] for m in modules) / max(len(modules), 1)
        critical = [m for m in modules if m["status"] == "critical"]
        attention = [m for m in modules if m["status"] == "attention"]

        snapshot = {
            "scanned_at": datetime.now(UTC).isoformat(),
            "overall_health": round(overall, 2),
            "overall_status": (
                "critical" if critical else "attention" if attention else "healthy"
            ),
            "module_count": len(modules),
            "modules": modules,
            "critical_modules": [m["module_id"] for m in critical],
            "attention_modules": [m["module_id"] for m in attention],
            "available_actions": list_action_types(),
            "limitations": list(self.policy.limitations),
            "policy": {
                "low_stock_threshold": self.policy.low_stock_threshold,
                "fraud_score_review_threshold": self.policy.fraud_score_review_threshold,
                "fraud_score_hold_threshold": self.policy.fraud_score_hold_threshold,
                "high_value_order_try": self.policy.high_value_order_try,
                "min_action_confidence": self.policy.min_action_confidence,
            },
        }
        self._last_scan_at = datetime.now(UTC)
        self._last_snapshot = snapshot
        return snapshot

    def get_snapshot(self, *, refresh: bool = False) -> dict[str, Any]:
        if refresh or self._last_snapshot is None:
            return self.scan()
        return self._last_snapshot

    def module_summary(self) -> list[dict[str, Any]]:
        snap = self.get_snapshot()
        return [
            {
                "module_id": m["module_id"],
                "label": m["label"],
                "status": m["status"],
                "health_score": m["health_score"],
                "signal_count": len(m.get("signals", [])),
                "automation_level": m["automation_level"],
                "ai_technique": m["ai_technique"],
            }
            for m in snap.get("modules", [])
        ]


def get_commerce_orchestrator() -> CommerceControlOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = CommerceControlOrchestrator()
    return _orchestrator
