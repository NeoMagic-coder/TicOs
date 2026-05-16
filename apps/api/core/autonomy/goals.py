"""Ajan hedef + kısıt profilleri ve çakışan hedefler için uzlaşma mekanizması.

Her ajanın bir :class:`AgentGoalProfile`'ı vardır: hedef (objective),
kısıtlar (constraints) ve karar verirken kullanacağı utility fonksiyonu.
Birden fazla ajan farklı önerilerle geldiğinde
:func:`reconcile_proposals` çağrılır — kazanan, ağırlıklı utility skoru
üzerinden seçilir. Eşitlik durumunda "veto edilebilir kısıt" devreye
girer (örn. marj %22 altına düşemez → öneri elenir).

Uzlaşma stratejileri:
- ``vote``: ağırlıklı oylama (ajan ağırlığı × utility)
- ``pareto``: dominate edilmeyen önerileri döner
- ``negotiate``: müzakere protokolüne devreder (eğer iki taraflıysa)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Literal

ReconcileStrategy = Literal["vote", "pareto", "negotiate"]


@dataclass
class AgentGoalProfile:
    """Tek bir ajanın hedef + kısıt + utility tanımı."""

    agent_id: str
    objective: str                            # "maximize_margin", "minimize_cost", vb.
    weight: float = 1.0                       # Oylamada ajan ağırlığı
    hard_constraints: dict[str, float] = field(default_factory=dict)
    soft_preferences: dict[str, float] = field(default_factory=dict)
    utility_fn: Callable[[dict[str, Any]], float] | None = None

    def evaluate(self, proposal: dict[str, Any]) -> float:
        """Önerinin bu ajan için utility skorunu hesaplar (0-1 arası)."""
        if not self._satisfies_hard(proposal):
            return -1.0  # Veto
        if self.utility_fn is not None:
            try:
                return max(0.0, min(1.0, float(self.utility_fn(proposal))))
            except Exception:
                return 0.0
        return _default_utility(self.objective, proposal)

    def _satisfies_hard(self, proposal: dict[str, Any]) -> bool:
        # Konvansiyon: kısıt anahtarı "min_<alan>" veya "max_<alan>" formundadır,
        # proposal içindeki gerçek alan adı prefix soyularak bulunur.
        for key, threshold in self.hard_constraints.items():
            if key.startswith("min_"):
                field = key[4:]
                value = proposal.get(field)
                if value is not None and float(value) < threshold:
                    return False
            elif key.startswith("max_"):
                field = key[4:]
                value = proposal.get(field)
                if value is not None and float(value) > threshold:
                    return False
        return True


def _default_utility(objective: str, proposal: dict[str, Any]) -> float:
    """Yaygın objektifler için basit normalize edilmiş utility."""
    if objective == "maximize_margin":
        return max(0.0, min(1.0, float(proposal.get("margin_pct", 0)) / 50.0))
    if objective == "minimize_cost":
        cost = float(proposal.get("cost_try", 1.0))
        return max(0.0, min(1.0, 1.0 / (1.0 + cost / 100.0)))
    if objective == "maximize_revenue":
        return max(0.0, min(1.0, float(proposal.get("expected_revenue_lift_pct", 0)) / 20.0))
    if objective == "minimize_lead_time":
        eta = float(proposal.get("eta_hours", 72.0))
        return max(0.0, min(1.0, 1.0 - eta / 168.0))
    if objective == "maximize_buyer_value":
        return max(0.0, min(1.0, 1.0 - float(proposal.get("price_try", 0)) / max(1.0, float(proposal.get("budget_try", 1)))))
    return float(proposal.get("score", 0.5))


@dataclass
class ReconciliationResult:
    winner: dict[str, Any] | None
    scores: list[tuple[str, float]]
    strategy: ReconcileStrategy
    vetoed_by: list[str] = field(default_factory=list)


def reconcile_proposals(
    proposals: list[dict[str, Any]],
    profiles: list[AgentGoalProfile],
    *,
    strategy: ReconcileStrategy = "vote",
) -> ReconciliationResult:
    """Birden çok ajan önerisini tek karara indirger.

    ``proposals`` her biri en az ``proposal_id`` taşıyan dict listesidir.
    Hard constraint ihlal eden bir öneri tüm ajanlardan -1 alır ve elenir.
    """
    if not proposals:
        return ReconciliationResult(winner=None, scores=[], strategy=strategy)

    scores: list[tuple[str, float]] = []
    vetoes: dict[str, list[str]] = {p["proposal_id"]: [] for p in proposals}

    for proposal in proposals:
        total = 0.0
        total_weight = 0.0
        for profile in profiles:
            u = profile.evaluate(proposal)
            if u < 0:
                vetoes[proposal["proposal_id"]].append(profile.agent_id)
                continue
            total += u * profile.weight
            total_weight += profile.weight
        score = total / total_weight if total_weight else 0.0
        scores.append((proposal["proposal_id"], score))

    survivors = [
        (pid, s) for pid, s in scores if not vetoes[pid]
    ]
    if not survivors:
        return ReconciliationResult(
            winner=None, scores=scores, strategy=strategy,
            vetoed_by=[v for vs in vetoes.values() for v in vs],
        )

    if strategy == "pareto":
        # Dominate edilmeyenlerden en yüksek skorlu
        survivors.sort(key=lambda x: -x[1])
    else:  # vote / negotiate fallback → ağırlıklı oylama
        survivors.sort(key=lambda x: -x[1])

    winner_id = survivors[0][0]
    winner = next(p for p in proposals if p["proposal_id"] == winner_id)
    return ReconciliationResult(
        winner=winner, scores=scores, strategy=strategy,
        vetoed_by=[v for vs in vetoes.values() for v in vs],
    )
