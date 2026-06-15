"""Commerce Control Layer — unified AI oversight REST API."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query

from apps.api.core.commerce.action_registry import list_action_types, propose_action
from apps.api.core.commerce.orchestrator import get_commerce_orchestrator
from apps.api.core.commerce.policy import get_commerce_policy, patch_commerce_policy
from apps.api.models.commerce_schemas import (
    CommerceActionPropose,
    CommerceControlSnapshot,
    CommercePolicyBody,
)

router = APIRouter(prefix="/commerce/control", tags=["commerce-control"])


@router.get("/snapshot", response_model=CommerceControlSnapshot)
async def control_snapshot(refresh: bool = Query(False)) -> dict[str, Any]:
    """Full module health snapshot — products, stock, orders, payment, support, fraud."""
    orch = get_commerce_orchestrator()
    return orch.get_snapshot(refresh=refresh)


@router.post("/scan", response_model=CommerceControlSnapshot)
async def control_scan() -> dict[str, Any]:
    """Force a fresh scan across all commerce modules."""
    return get_commerce_orchestrator().scan()


@router.get("/modules")
async def control_modules(refresh: bool = Query(False)) -> list[dict[str, Any]]:
    """Compact per-module summary for dashboards."""
    orch = get_commerce_orchestrator()
    if refresh:
        orch.scan()
    return orch.module_summary()


@router.get("/policy")
async def get_policy() -> dict[str, Any]:
    pol = get_commerce_policy()
    return {
        "low_stock_threshold": pol.low_stock_threshold,
        "fraud_score_review_threshold": pol.fraud_score_review_threshold,
        "fraud_score_hold_threshold": pol.fraud_score_hold_threshold,
        "high_value_order_try": pol.high_value_order_try,
        "min_action_confidence": pol.min_action_confidence,
        "auto_restock_suggestion": pol.auto_restock_suggestion,
        "auto_flag_fraud": pol.auto_flag_fraud,
        "support_sla_hours": pol.support_sla_hours,
    }


@router.patch("/policy")
async def patch_policy(body: CommercePolicyBody) -> dict[str, Any]:
    patch_commerce_policy(**body.model_dump(exclude_none=True))
    get_commerce_orchestrator().policy = get_commerce_policy()
    return await get_policy()


@router.get("/actions")
async def list_actions() -> list[dict[str, str]]:
    return list_action_types()


@router.post("/actions/propose")
async def propose_commerce_action(body: CommerceActionPropose) -> dict[str, Any]:
    """Propose a commerce action; routes to approval queue when policy requires."""
    return propose_action(
        action_type=body.action_type,  # type: ignore[arg-type]
        module_id=body.module_id,
        params=body.params,
        confidence=body.confidence,
        risk_level=body.risk_level,
        agent_id=body.agent_id,
    )


@router.get("/limitations")
async def limitations() -> dict[str, Any]:
    pol = get_commerce_policy()
    return {"limitations": list(pol.limitations)}
