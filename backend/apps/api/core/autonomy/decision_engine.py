"""Policy-gated autonomous decision engine.

The engine accepts a proposed action with metadata (type, value, risk,
confidence) and decides whether it falls within the autonomy budget. The
policy is intentionally declarative — thresholds live in
:class:`AutonomyPolicy` so they can be tuned per-tenant without touching
code. Decisions are deterministic and side-effect free; callers persist
them via the ``decision_log_writer`` tool.

Also contains :class:`HybridPricingPolicy` — a "rule + epsilon-greedy
bandit" approach for dynamic price adjustments that combines hard safety
rules with exploratory learning.
"""
from __future__ import annotations

import random
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


# ── Hybrid Pricing Policy ──────────────────────────────────────────────────────


@dataclass
class BanditArm:
    """Single price-change candidate tracked by the epsilon-greedy bandit."""
    change_pct: float       # e.g. -5.0 means "lower price by 5%"
    total_reward: float = 0.0
    n_pulls: int = 0

    @property
    def avg_reward(self) -> float:
        return self.total_reward / self.n_pulls if self.n_pulls > 0 else 0.0

    def update(self, reward: float) -> None:
        self.n_pulls += 1
        self.total_reward += reward


@dataclass
class PricingSignal:
    """Context fed into :class:`HybridPricingPolicy` for a single SKU."""
    current_price: float
    roas: float               # Return On Ad Spend (revenue / ad_spend)
    competitor_price: float
    margin_pct: float         # Current margin as a fraction (e.g. 0.25 = 25%)
    min_margin_pct: float = 0.22  # Hard floor — policy never goes below this


@dataclass
class PricingDecision:
    action: Literal["adjust", "cut_budget", "hold", "needs_approval"]
    change_pct: float         # Suggested price change (0.0 if hold/cut_budget)
    new_price: float
    reason: str
    source: Literal["rule", "bandit", "hold"]
    arm_idx: int | None = None   # Which bandit arm was selected (None for rule/hold)


class HybridPricingPolicy:
    """Rule + epsilon-greedy bandit fiyatlandırma politikası.

    Karar akışı:
    1. Deterministik kural katmanı (ROAS, marj koruma) — kural devreye
       girerse bandit atlanır.
    2. Kural geçilirse bandit kollarından birini seç (ε-greedy).
    3. Seçilen değişim marj tabanını ihlal ediyorsa "hold".
    4. Değişim politika sınırını (%max_price_change_pct) aşıyorsa
       "needs_approval".

    Bandit güncelleme: dışarıdan gelen ``reward`` (örn. ROAS değişimi,
    dönüşüm oranı delta) ile ``update(arm_idx, reward)`` çağrılır.
    """

    DEFAULT_ARMS: list[float] = [-5.0, -3.0, -1.5, 0.0, 1.5, 3.0, 5.0]

    def __init__(
        self,
        *,
        epsilon: float = 0.10,
        max_price_change_pct: float = 5.0,
        roas_cut_threshold: float = 1.5,
        arms: list[float] | None = None,
        seed: int | None = None,
    ) -> None:
        self.epsilon = epsilon
        self.max_price_change_pct = max_price_change_pct
        self.roas_cut_threshold = roas_cut_threshold
        self._rng = random.Random(seed)
        self.arms: list[BanditArm] = [BanditArm(change_pct=c) for c in (arms or self.DEFAULT_ARMS)]

    # ── Rule layer ──────────────────────────────────────────────────────────

    def _rule_decision(self, signal: PricingSignal) -> PricingDecision | None:
        """Return a hard rule decision or None to let the bandit decide."""
        # ROAS < threshold → cut ad budget, hold price
        if signal.roas < self.roas_cut_threshold:
            return PricingDecision(
                action="cut_budget",
                change_pct=0.0,
                new_price=signal.current_price,
                reason=f"ROAS {signal.roas:.2f} < eşik {self.roas_cut_threshold:.2f} — reklam bütçesini kes, fiyatı tut.",
                source="rule",
            )
        # Margin below floor → hold, do not reduce price further
        if signal.margin_pct <= signal.min_margin_pct:
            return PricingDecision(
                action="hold",
                change_pct=0.0,
                new_price=signal.current_price,
                reason=f"Mevcut marj %{signal.margin_pct*100:.1f} ≤ taban %{signal.min_margin_pct*100:.1f} — fiyat düşürme yok.",
                source="rule",
            )
        return None

    # ── Bandit layer ────────────────────────────────────────────────────────

    def _select_arm(self) -> tuple[int, BanditArm]:
        if self._rng.random() < self.epsilon:
            idx = self._rng.randrange(len(self.arms))
        else:
            idx = max(range(len(self.arms)), key=lambda i: self.arms[i].avg_reward)
        return idx, self.arms[idx]

    def update(self, arm_idx: int, reward: float) -> None:
        """Bandit kolunu geri bildirimle güncelle (reward: ROAS Δ veya CVR Δ)."""
        if 0 <= arm_idx < len(self.arms):
            self.arms[arm_idx].update(reward)

    # ── Main entry point ────────────────────────────────────────────────────

    def decide(self, signal: PricingSignal) -> PricingDecision:
        rule = self._rule_decision(signal)
        if rule is not None:
            return rule

        arm_idx, arm = self._select_arm()
        change_pct = arm.change_pct

        new_price = round(signal.current_price * (1 + change_pct / 100), 2)

        # Margin floor check after applying change
        new_margin = signal.margin_pct - (change_pct / 100)
        if new_margin < signal.min_margin_pct:
            return PricingDecision(
                action="hold",
                change_pct=0.0,
                new_price=signal.current_price,
                reason=f"Seçilen kol %{change_pct:+.1f} marjı taban altına düşürüyor — fiyat tutuldu.",
                source="bandit",
                arm_idx=arm_idx,
            )

        if abs(change_pct) > self.max_price_change_pct:
            return PricingDecision(
                action="needs_approval",
                change_pct=change_pct,
                new_price=new_price,
                reason=f"Değişim %{change_pct:+.1f} politika sınırı %{self.max_price_change_pct:.1f}'i aşıyor — onay gerekli.",
                source="bandit",
                arm_idx=arm_idx,
            )

        return PricingDecision(
            action="adjust",
            change_pct=change_pct,
            new_price=new_price,
            reason=f"Bandit kolu %{change_pct:+.1f} seçildi (ε={self.epsilon:.2f}, ort.ödül={arm.avg_reward:.3f}).",
            source="bandit",
            arm_idx=arm_idx,
        )
