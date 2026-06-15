"""Action registry — propose commerce actions with policy + decision engine."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from apps.api.core.autonomy.decision_engine import DecisionEngine
from apps.api.core.commerce.policy import CommerceControlPolicy, get_commerce_policy
from apps.api.models.schemas import ApprovalRequest
from apps.api.services.task_store import get_approval_store

ActionType = Literal[
    "flag_order_review",
    "hold_high_risk_order",
    "suggest_restock",
    "escalate_support",
    "sync_inventory",
    "enrich_product_content",
]

_ACTION_META: dict[str, dict[str, Any]] = {
    "flag_order_review": {
        "label": "Siparişi incelemeye al",
        "default_risk": "medium",
        "action_type": "fraud_review",
    },
    "hold_high_risk_order": {
        "label": "Yüksek riskli siparişi beklet",
        "default_risk": "high",
        "action_type": "order_hold",
    },
    "suggest_restock": {
        "label": "Yeniden stok öner",
        "default_risk": "low",
        "action_type": "restock_suggestion",
    },
    "escalate_support": {
        "label": "Destek görevini eskale et",
        "default_risk": "low",
        "action_type": "support_escalation",
    },
    "sync_inventory": {
        "label": "Envanter senkronizasyonu",
        "default_risk": "low",
        "action_type": "inventory_sync",
    },
    "enrich_product_content": {
        "label": "Ürün içeriği zenginleştir",
        "default_risk": "low",
        "action_type": "content_enrichment",
    },
}


def list_action_types() -> list[dict[str, str]]:
    return [
        {"action_type": k, "label": v["label"], "default_risk": v["default_risk"]}
        for k, v in _ACTION_META.items()
    ]


def propose_action(
    *,
    action_type: ActionType,
    module_id: str,
    params: dict[str, Any] | None = None,
    confidence: float = 0.8,
    risk_level: str | None = None,
    agent_id: str = "commerce_control",
    policy: CommerceControlPolicy | None = None,
) -> dict[str, Any]:
    """Evaluate a commerce action; create approval when policy requires human gate."""
    pol = policy or get_commerce_policy()
    meta = _ACTION_META.get(action_type)
    if meta is None:
        return {"accepted": False, "reason": f"Bilinmeyen aksiyon: {action_type}"}

    risk = risk_level or meta["default_risk"]
    engine = DecisionEngine()
    outcome = engine.evaluate(
        action_type=meta["action_type"],
        value=float(params.get("value", 0) if params else 0),
        risk_level=risk,
        confidence=confidence,
    )

    if confidence < pol.min_action_confidence:
        outcome_status = "needs_approval"
        outcome_reason = (
            f"Güven {confidence:.2f} < commerce eşiği {pol.min_action_confidence:.2f}"
        )
    else:
        outcome_status = outcome.status
        outcome_reason = outcome.reason

    result: dict[str, Any] = {
        "action_type": action_type,
        "module_id": module_id,
        "params": params or {},
        "confidence": confidence,
        "risk_level": risk,
        "decision_status": outcome_status,
        "decision_reason": outcome_reason,
        "decision_id": outcome.decision_id,
        "approval_id": None,
    }

    if outcome_status == "needs_approval":
        approval_id = f"appr_{uuid.uuid4().hex[:8]}"
        now = datetime.now(UTC)
        approval = ApprovalRequest(
            id=approval_id,
            task_id=params.get("task_id", "commerce_control") if params else "commerce_control",
            agent_id=agent_id,
            action=action_type,
            description=f"[Commerce Control] {meta['label']} — {module_id}",
            params={"module_id": module_id, **(params or {})},
            risk_level=risk,  # type: ignore[arg-type]
            expected_impact=outcome_reason,
            status="pending",
            created_at=now,
        )
        get_approval_store().create(approval)
        result["approval_id"] = approval_id

    return result
