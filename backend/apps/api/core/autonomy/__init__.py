"""Autonomy layer: decentralized coordination, negotiation, and policy-gated decisions.

This package implements the cooperative/competitive primitives that the
multi-agent layer (negotiation, logistics, dynamic_pricing,
autonomous_decision agents) builds on. The layer is intentionally
decentralized: no single component holds global state; each protocol
exchange is a pure function over inputs + a small in-memory ledger.
"""
from __future__ import annotations

from apps.api.core.autonomy.decision_engine import (
    AutonomyPolicy,
    DecisionEngine,
    DecisionOutcome,
)
from apps.api.core.autonomy.negotiation import (
    NegotiationProtocol,
    NegotiationRound,
    NegotiationState,
)
from apps.api.core.autonomy.coordination import (
    BROADCAST,
    CoordinationBus,
    CoordinationMessage,
    get_coordination_bus,
)
from apps.api.core.autonomy.goals import (
    AgentGoalProfile,
    ReconciliationResult,
    reconcile_proposals,
)
from apps.api.core.autonomy import ontology
from apps.api.core.autonomy.marketplace_router import (
    MarketplaceRouter,
    MarketplaceTarget,
    default_marketplace_targets,
    get_marketplace_router,
)

__all__ = [
    "AutonomyPolicy",
    "DecisionEngine",
    "DecisionOutcome",
    "NegotiationProtocol",
    "NegotiationRound",
    "NegotiationState",
    "CoordinationBus",
    "CoordinationMessage",
    "BROADCAST",
    "get_coordination_bus",
    "AgentGoalProfile",
    "ReconciliationResult",
    "reconcile_proposals",
    "ontology",
    "MarketplaceRouter",
    "MarketplaceTarget",
    "default_marketplace_targets",
    "get_marketplace_router",
]
