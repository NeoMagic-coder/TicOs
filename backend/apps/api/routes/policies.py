"""Autonomy policy endpoints — read & update thresholds used by the
decision engine. Stored in-process; persistence can be layered later.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from apps.api.core.autonomy.runtime import get_autonomy_mode, patch_autonomy_mode
from apps.api.core.autonomy.goal_loop import get_loop_status, run_goal_loop_tick
from apps.api.core.autonomy.marketplace_router import default_marketplace_targets, get_marketplace_router
from apps.api.core.autonomy.sweeps import last_sweep_results, run_autonomy_pulse, sweep_low_risk_approvals
from apps.api.core.messaging import get_message_bus
from apps.api.core.hermes.orchestrator import HermesOrchestrator
from apps.api.core.scheduler import scheduler_status, trigger_job_now
from apps.api.services.task_store import get_approval_store

router = APIRouter(prefix="/approvals", tags=["policies"])
autonomy_router = APIRouter(prefix="/autonomy", tags=["autonomy"])


class AutonomyPolicy(BaseModel):
    max_price_change_pct: float = Field(default=5.0, ge=0, le=100)
    carrier_switch_max_cost_try: float = Field(default=500, ge=0)
    min_confidence: float = Field(default=0.75, ge=0, le=1)
    risk_auto_threshold: float = Field(default=0.3, ge=0, le=1)


class AutonomyPolicyPatch(BaseModel):
    max_price_change_pct: float | None = Field(default=None, ge=0, le=100)
    carrier_switch_max_cost_try: float | None = Field(default=None, ge=0)
    min_confidence: float | None = Field(default=None, ge=0, le=1)
    risk_auto_threshold: float | None = Field(default=None, ge=0, le=1)


class AutonomyModePatch(BaseModel):
    enabled: bool | None = None
    auto_sync: bool | None = None
    auto_brief: bool | None = None
    auto_approve_low_risk: bool | None = None
    auto_goal_loop: bool | None = None


_POLICY = AutonomyPolicy()


@router.get("/policy", response_model=AutonomyPolicy)
async def get_policy() -> AutonomyPolicy:
    return _POLICY


@router.put("/policy", response_model=AutonomyPolicy)
async def put_policy(body: AutonomyPolicy) -> AutonomyPolicy:
    global _POLICY
    _POLICY = body
    return _POLICY


@autonomy_router.get("/policy", response_model=AutonomyPolicy)
async def get_autonomy_policy() -> AutonomyPolicy:
    return _POLICY


@autonomy_router.patch("/policy", response_model=AutonomyPolicy)
async def patch_autonomy_policy(body: AutonomyPolicyPatch) -> AutonomyPolicy:
    global _POLICY
    data = _POLICY.model_dump()
    for key, val in body.model_dump(exclude_none=True).items():
        data[key] = val
    _POLICY = AutonomyPolicy(**data)
    return _POLICY


@autonomy_router.put("/policy", response_model=AutonomyPolicy)
async def put_autonomy_policy(body: AutonomyPolicy) -> AutonomyPolicy:
    global _POLICY
    _POLICY = body
    return _POLICY


@autonomy_router.get("/status")
async def get_autonomy_status() -> dict[str, Any]:
    """Scheduler + policy + runtime mode — single autonomy dashboard payload."""
    sched = scheduler_status()
    next_jobs = [
        j for j in sched.get("jobs", [])
        if j.get("next_run_time")
    ]
    next_jobs.sort(key=lambda j: j["next_run_time"])
    pending = get_approval_store().all()
    pending_low = sum(
        1 for a in pending
        if a.status in {"pending", "estimating"} and (a.risk_level or "").lower() == "low"
    )
    pending_total = sum(1 for a in pending if a.status in {"pending", "estimating"})
    return {
        "mode": get_autonomy_mode(),
        "policy": _POLICY.model_dump(),
        "scheduler": sched,
        "next_job": next_jobs[0] if next_jobs else None,
        "job_count": len(sched.get("jobs", [])),
        "pending_approvals": pending_total,
        "pending_low_risk": pending_low,
        "last_sweeps": last_sweep_results(),
        "goal_loop": get_loop_status(),
    }


@autonomy_router.post("/sweep")
async def post_autonomy_sweep() -> dict[str, Any]:
    """Run inventory sync + low-risk approval sweep immediately."""
    if not get_autonomy_mode().get("enabled", True):
        return {"ok": False, "reason": "autonomy_disabled"}
    result = await run_autonomy_pulse()
    return {"ok": True, **result}


@autonomy_router.post("/sweep/approvals")
async def post_approval_sweep() -> dict[str, Any]:
    result = sweep_low_risk_approvals()
    return {"ok": not result.get("skipped"), **result}


@autonomy_router.post("/jobs/{job_id}/run")
async def run_scheduler_job(job_id: str) -> dict[str, Any]:
    return await trigger_job_now(job_id)


@autonomy_router.get("/mode")
async def get_autonomy_mode_endpoint() -> dict[str, Any]:
    return get_autonomy_mode()


@autonomy_router.patch("/mode")
async def patch_autonomy_mode_endpoint(body: AutonomyModePatch) -> dict[str, Any]:
    return patch_autonomy_mode(**body.model_dump(exclude_none=True))


@autonomy_router.get("/loop/status")
async def get_goal_loop_status() -> dict[str, Any]:
    return get_loop_status()


@autonomy_router.post("/loop/tick")
async def post_goal_loop_tick(goal_id: str | None = None) -> dict[str, Any]:
    """Manually run one goal-loop tick (optionally for a single goal)."""
    if not get_autonomy_mode().get("enabled", True):
        return {"ok": False, "reason": "autonomy_disabled"}
    result = await run_goal_loop_tick(HermesOrchestrator(), goal_id=goal_id)
    return {"ok": not result.get("skipped"), **result}


@autonomy_router.get("/messaging/status")
async def get_messaging_status() -> dict[str, Any]:
    """A2A bus + marketplace router snapshot for ops dashboards."""
    router = get_marketplace_router()
    bus_history = get_message_bus().history()
    return {
        "a2a_history_count": len(bus_history),
        "recent_intents": [
            m.intent for m in bus_history[-10:]
        ],
        "marketplace_targets": [
            {"marketplace": t.marketplace, "agent_id": t.agent_id}
            for t in default_marketplace_targets()
        ],
        "router_sender": router.sender_id,
    }


class MarketplaceDispatchBody(BaseModel):
    topic: str = "bid.request"
    payload: dict[str, Any] = Field(default_factory=dict)
    marketplaces: list[str] | None = None


@autonomy_router.post("/marketplace/dispatch")
async def post_marketplace_dispatch(body: MarketplaceDispatchBody) -> dict[str, Any]:
    """Route a payload to marketplace agents via CoordinationBus (+ A2A relay)."""
    if not get_autonomy_mode().get("enabled", True):
        return {"ok": False, "reason": "autonomy_disabled"}
    router = get_marketplace_router()
    result = await router.dispatch(
        topic=body.topic,
        payload=body.payload,
        marketplaces=body.marketplaces,
    )
    return {
        "ok": result.winner is not None,
        "winner": result.winner,
        "scores": result.scores,
        "strategy": result.strategy,
        "vetoed_by": result.vetoed_by,
    }
