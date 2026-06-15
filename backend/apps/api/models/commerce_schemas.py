"""Pydantic schemas for the Commerce Control Layer API."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class CommerceModuleSignal(BaseModel):
    type: str
    severity: str = "low"
    count: int | None = None
    product_id: str | None = None
    order_id: str | None = None
    order_number: str | None = None
    fraud_score: float | None = None
    reasons: list[str] | None = None
    sku: str | None = None
    stock: int | None = None
    amount: float | None = None


class CommerceModuleSnapshot(BaseModel):
    module_id: str
    label: str
    status: Literal["healthy", "attention", "critical"]
    automation_level: str
    ai_technique: str
    health_score: float
    signals: list[CommerceModuleSignal] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class CommerceControlSnapshot(BaseModel):
    scanned_at: str
    overall_health: float
    overall_status: Literal["healthy", "attention", "critical"]
    module_count: int
    modules: list[CommerceModuleSnapshot]
    critical_modules: list[str] = Field(default_factory=list)
    attention_modules: list[str] = Field(default_factory=list)
    available_actions: list[dict[str, str]] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    policy: dict[str, Any] = Field(default_factory=dict)


class CommercePolicyBody(BaseModel):
    low_stock_threshold: int | None = Field(default=None, ge=1, le=1000)
    fraud_score_review_threshold: float | None = Field(default=None, ge=0, le=1)
    fraud_score_hold_threshold: float | None = Field(default=None, ge=0, le=1)
    high_value_order_try: float | None = Field(default=None, ge=0)
    min_action_confidence: float | None = Field(default=None, ge=0, le=1)
    auto_restock_suggestion: bool | None = None
    auto_flag_fraud: bool | None = None
    support_sla_hours: int | None = Field(default=None, ge=1, le=168)


class CommerceActionPropose(BaseModel):
    action_type: str
    module_id: str
    params: dict[str, Any] = Field(default_factory=dict)
    confidence: float = Field(default=0.8, ge=0, le=1)
    risk_level: Literal["low", "medium", "high", "critical"] | None = None
    agent_id: str = "commerce_control"
