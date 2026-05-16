"""Pazarlık protokolü.

İki taraflı (alıcı/satıcı veya marka/tedarikçi) müzakere için sade bir state
machine. Her taraf kendi hedef + walk-away değerine sahiptir; protokol
ZOPA (Zone Of Possible Agreement) içinde kalırsa anlaşma üretir, dışarı
çıkarsa walk-away ile sonlanır.

Karar tamamen deterministik ve saf bir fonksiyon: aynı girdiler → aynı
çıktılar. Test edilebilir ve reproducible. Concession curve "moderate"
varsayılan; "aggressive" ve "soft" alternatifleri vardır.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

ConcessionStyle = Literal["soft", "moderate", "aggressive"]
Outcome = Literal["agreement", "walk_away", "ongoing"]

_CONCESSION_RATIO: dict[ConcessionStyle, float] = {
    "soft": 0.45,
    "moderate": 0.30,
    "aggressive": 0.18,
}


@dataclass
class NegotiationRound:
    round_no: int
    buyer_offer: float
    seller_offer: float
    gap: float


@dataclass
class NegotiationState:
    buyer_target: float       # Alıcının hedef fiyatı (düşük)
    buyer_walk_away: float    # Alıcının max ödeyebileceği
    seller_target: float      # Satıcının hedef fiyatı (yüksek)
    seller_walk_away: float   # Satıcının min kabul edeceği
    style: ConcessionStyle = "moderate"
    max_rounds: int = 5
    rounds: list[NegotiationRound] = field(default_factory=list)
    outcome: Outcome = "ongoing"
    final_price: float | None = None

    @property
    def has_zopa(self) -> bool:
        # ZOPA: satıcının kabul edeceği min ≤ alıcının ödeyebileceği max
        return self.seller_walk_away <= self.buyer_walk_away


class NegotiationProtocol:
    """Çok turlu pazarlık simülasyonu — concession curve tabanlı."""

    def run(self, state: NegotiationState) -> NegotiationState:
        if not state.has_zopa:
            state.outcome = "walk_away"
            return state

        ratio = _CONCESSION_RATIO[state.style]
        buyer = state.buyer_target
        seller = state.seller_target

        for i in range(1, state.max_rounds + 1):
            gap = seller - buyer
            state.rounds.append(
                NegotiationRound(round_no=i, buyer_offer=buyer, seller_offer=seller, gap=gap)
            )

            # Anlaşma: fark hedef toplamın %1'inden az
            if gap <= max(0.5, 0.01 * (state.buyer_target + state.seller_target) / 2):
                state.outcome = "agreement"
                state.final_price = round((buyer + seller) / 2, 2)
                return state

            # Her taraf concession curve oranında karşıya yaklaşır
            buyer = min(buyer + gap * ratio, state.buyer_walk_away)
            seller = max(seller - gap * ratio, state.seller_walk_away)

            # Çakıştıysa orta noktada anlaş
            if buyer >= seller:
                state.outcome = "agreement"
                state.final_price = round((buyer + seller) / 2, 2)
                return state

        # Tur limiti dolduysa walk-away
        state.outcome = "walk_away"
        return state
