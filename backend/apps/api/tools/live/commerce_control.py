"""Live adapters for Commerce Control Layer tools."""
from __future__ import annotations

from typing import Any

from apps.api.core.commerce.action_registry import propose_action
from apps.api.core.commerce.analyzers import analyze_fraud
from apps.api.core.commerce.orchestrator import get_commerce_orchestrator
from apps.api.core.logging import get_logger
from apps.api.core.openclaw.executor import register_live_adapter

log = get_logger(__name__)


async def _commerce_control_scan(payload: dict[str, Any]) -> dict[str, Any]:
    refresh = bool(payload.get("refresh", True))
    snap = get_commerce_orchestrator().get_snapshot(refresh=refresh)
    log.info("commerce.scan", status=snap.get("overall_status"), health=snap.get("overall_health"))
    return snap


async def _commerce_fraud_check(payload: dict[str, Any]) -> dict[str, Any]:
    module = analyze_fraud()
    order_id = str(payload.get("order_id") or "").strip()
    flagged = module.get("signals", [])
    if order_id:
        flagged = [s for s in flagged if s.get("order_id") == order_id]
    return {
        "flagged_count": len(flagged),
        "flagged_orders": flagged,
        "module_status": module.get("status"),
        "recommendations": module.get("recommendations", []),
        "disclaimer": "Kural tabanlı skor; yanlış pozitif mümkündür.",
    }


async def _commerce_action_propose(payload: dict[str, Any]) -> dict[str, Any]:
    action_type = str(payload.get("action_type") or "")
    module_id = str(payload.get("module_id") or "")
    if not action_type or not module_id:
        return {"accepted": False, "reason": "action_type ve module_id zorunlu"}
    return propose_action(
        action_type=action_type,  # type: ignore[arg-type]
        module_id=module_id,
        params=payload.get("params") or {},
        confidence=float(payload.get("confidence") or 0.8),
        risk_level=payload.get("risk_level"),
        agent_id=str(payload.get("agent_id") or "commerce_control"),
    )


def register() -> None:
    for tool_id, fn in (
        ("commerce_control_scan", _commerce_control_scan),
        ("commerce_fraud_check", _commerce_fraud_check),
        ("commerce_action_propose", _commerce_action_propose),
    ):
        register_live_adapter(tool_id, fn)
