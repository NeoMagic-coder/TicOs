"""Policy-gated autonomous decision engine.

The engine accepts a proposed action with metadata (type, value, risk,
confidence) and decides whether it falls within the autonomy budget. The
policy is intentionally declarative — thresholds live in
:class:`AutonomyPolicy` so they can be tuned per-tenant without touching
code. Decisions are deterministic and side-effect free; callers persist
them via the ``decision_log_writer`` tool.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Literal

DecisionStatus = Literal["auto_approved", "needs_approval", "rejected"]


@dataclass(frozen=True)
class AutonomyPolicy:
    """Per-tenant autonomy limits. All values are upper bounds (inclusive)."""

    max_price_change_pct: float = 5.0
    max_carrier_switch_cost_try: float = 500.0
    max_negotiation_walk_away_try: float = 50_000.0
    min_confidence: float = 0.7
    risk_auto_threshold: str = "low"  # low < medium < high < critical
    _RISK_ORDER: tuple[str, ...] = field(
        default=("low", "medium", "high", "critical"), repr=False
    )

    def risk_rank(self, level: str) -> int:
        try:
            return self._RISK_ORDER.index(level)
        except ValueError:
            return len(self._RISK_ORDER)


@dataclass
class DecisionOutcome:
    status: DecisionStatus
    reason: str
    decision_id: str
    decided_at: datetime


class DecisionEngine:
    """Evaluates proposed agent actions against an :class:`AutonomyPolicy`."""

    def __init__(self, policy: AutonomyPolicy | None = None) -> None:
        self.policy = policy or AutonomyPolicy()
        self._counter = 0

    def _next_id(self) -> str:
        self._counter += 1
        return f"dec_{self._counter:06d}"

    def evaluate(
        self,
        *,
        action_type: str,
        value: float = 0.0,
        risk_level: str = "low",
        confidence: float = 1.0,
    ) -> DecisionOutcome:
        now = datetime.now(UTC)
        decision_id = self._next_id()

        if confidence < self.policy.min_confidence:
            return DecisionOutcome(
                status="needs_approval",
                reason=f"Güven {confidence:.2f} < eşik {self.policy.min_confidence:.2f}",
                decision_id=decision_id,
                decided_at=now,
            )

        if self.policy.risk_rank(risk_level) > self.policy.risk_rank(
            self.policy.risk_auto_threshold
        ):
            return DecisionOutcome(
                status="needs_approval",
                reason=f"Risk seviyesi '{risk_level}' otomatik onay eşiği üstünde.",
                decision_id=decision_id,
                decided_at=now,
            )

        breach = self._limit_breach(action_type, value)
        if breach:
            return DecisionOutcome(
                status="needs_approval",
                reason=breach,
                decision_id=decision_id,
                decided_at=now,
            )

        return DecisionOutcome(
            status="auto_approved",
            reason="Politika sınırları içinde, otomatik onaylandı.",
            decision_id=decision_id,
            decided_at=now,
        )

    def _limit_breach(self, action_type: str, value: float) -> str | None:
        if action_type == "price_change_pct":
            if abs(value) > self.policy.max_price_change_pct:
                return (
                    f"Fiyat değişimi %{value:.1f} > limit %"
                    f"{self.policy.max_price_change_pct:.1f}"
                )
        elif action_type == "carrier_switch_cost_try":
            if value > self.policy.max_carrier_switch_cost_try:
                return (
                    f"Taşıyıcı değişim maliyeti {value:.0f}TL > limit "
                    f"{self.policy.max_carrier_switch_cost_try:.0f}TL"
                )
        elif action_type == "negotiation_commit_try":
            if value > self.policy.max_negotiation_walk_away_try:
                return (
                    f"Müzakere taahhüdü {value:.0f}TL > limit "
                    f"{self.policy.max_negotiation_walk_away_try:.0f}TL"
                )
        return None
