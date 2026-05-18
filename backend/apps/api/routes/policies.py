"""Autonomy policy endpoints — read & update thresholds used by the
decision engine. Stored in-process; persistence can be layered later.
"""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

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
