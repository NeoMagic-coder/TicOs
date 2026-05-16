"""Pazaryeri sevk yönlendiricisi (Marketplace Router).

Birden çok pazaryeri (Trendyol, Hepsiburada, Amazon TR, Shopify) üzerinde
çalışan satıcı ajanlarına gelen siparişleri/talepleri **sevk eder**, ama
karar otoritesini elinde tutmaz. Her sevk:

1. :class:`CoordinationBus` üzerinden ilgili ajana bir mesaj atar
2. Ajanın geri dönen önerisini bekler (timeout'lu)
3. Birden fazla teklif varsa :func:`reconcile_proposals` ile birleştirir

Bu router, "ince koordinatör + bağımsız ajan" desenidir: tek nokta hatası
değildir, sadece bir routing katmanıdır.
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from apps.api.core.autonomy.coordination import CoordinationBus, CoordinationMessage
from apps.api.core.autonomy.goals import (
    AgentGoalProfile,
    ReconciliationResult,
    reconcile_proposals,
)


@dataclass
class MarketplaceTarget:
    marketplace: str            # "trendyol", "hepsiburada", "shopify", ...
    agent_id: str               # bu pazaryerinden sorumlu satıcı/operasyon ajanı
    profile: AgentGoalProfile


class MarketplaceRouter:
    """Sipariş veya talep paketini ilgili pazaryeri ajan(lar)ına sevk eder."""

    def __init__(
        self,
        bus: CoordinationBus,
        targets: list[MarketplaceTarget],
        *,
        sender_id: str = "marketplace_router",
        response_timeout_s: float = 5.0,
    ) -> None:
        self.bus = bus
        self.targets = {t.marketplace: t for t in targets}
        self.sender_id = sender_id
        self.response_timeout_s = response_timeout_s

    async def dispatch(
        self,
        *,
        topic: str,
        payload: dict[str, Any],
        marketplaces: list[str] | None = None,
    ) -> ReconciliationResult:
        targets = (
            [self.targets[m] for m in marketplaces if m in self.targets]
            if marketplaces
            else list(self.targets.values())
        )
        if not targets:
            return ReconciliationResult(winner=None, scores=[], strategy="vote")

        # 1) Talebi paralel olarak ilgili ajanlara yayınla
        await asyncio.gather(*[
            self.bus.publish(CoordinationMessage(
                sender=self.sender_id,
                recipient=t.agent_id,
                topic=topic,
                payload={**payload, "marketplace": t.marketplace},
            ))
            for t in targets
        ])

        # 2) Geri dönen önerileri timeout'lu topla
        responses = await asyncio.gather(*[
            self.bus.subscribe(self.sender_id + ":" + t.agent_id, timeout=self.response_timeout_s)
            for t in targets
        ])

        proposals: list[dict[str, Any]] = []
        for resp, target in zip(responses, targets):
            if resp is None:
                continue
            proposal = dict(resp.payload)
            proposal.setdefault("proposal_id", f"{target.marketplace}:{resp.correlation_id}")
            proposal["marketplace"] = target.marketplace
            proposal["agent_id"] = target.agent_id
            proposals.append(proposal)

        # 3) Çakışan önerileri uzlaştır
        return reconcile_proposals(
            proposals, [t.profile for t in targets], strategy="vote"
        )
