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


@dataclass
class NegotiationTemplate:
    """Senaryo bazlı müzakere şablonu. build_state() ile NegotiationState üretir."""
    scenario: str          # "supplier_rfq" | "influencer_fee" | "carrier_negotiation"
    context: dict          # Senaryo girdileri (birimi TRY)
    style: ConcessionStyle = "moderate"
    max_rounds: int = 5

    def build_state(self) -> NegotiationState:
        """Şablona özgü hedef ve walk-away değerlerini hesapla."""
        c = self.context
        if self.scenario == "supplier_rfq":
            # Alıcı: hedef maliyet = target_cogs, max = current_cogs
            # Satıcı: hedef fiyat = current_cogs, min = floor_price
            return NegotiationState(
                buyer_target=float(c.get("target_cogs", 0)),
                buyer_walk_away=float(c.get("current_cogs", 0)) * 1.05,
                seller_target=float(c.get("current_cogs", 0)),
                seller_walk_away=float(c.get("floor_price", 0)),
                style=self.style,
                max_rounds=self.max_rounds,
            )
        if self.scenario == "influencer_fee":
            # Alıcı: hedef fee = budget_per_post, max = budget_per_post * 1.3
            # Satıcı: hedef fee = quoted_fee, min = min_acceptable_fee
            return NegotiationState(
                buyer_target=float(c.get("budget_per_post", 0)),
                buyer_walk_away=float(c.get("budget_per_post", 0)) * 1.30,
                seller_target=float(c.get("quoted_fee", 0)),
                seller_walk_away=float(c.get("min_acceptable_fee", 0)),
                style=self.style,
                max_rounds=self.max_rounds,
            )
        if self.scenario == "carrier_negotiation":
            # Alıcı: hedef = target_rate_per_kg, max = current_rate * 1.05
            # Satıcı: hedef = current_rate, min = floor_rate
            return NegotiationState(
                buyer_target=float(c.get("target_rate_per_kg", 0)),
                buyer_walk_away=float(c.get("current_rate_per_kg", 0)) * 1.05,
                seller_target=float(c.get("current_rate_per_kg", 0)),
                seller_walk_away=float(c.get("floor_rate_per_kg", 0)),
                style=self.style,
                max_rounds=self.max_rounds,
            )
        raise ValueError(f"Unknown scenario: {self.scenario!r}")

    def summary(self, result: NegotiationState) -> str:
        """Sonucu Türkçe tek cümle ile özetle."""
        if result.outcome == "agreement":
            price = result.final_price
            labels = {
                "supplier_rfq": f"Tedarikçi anlaşması: ₺{price:.2f}/adet (COGS)",
                "influencer_fee": f"Influencer anlaşması: ₺{price:.2f}/gönderi",
                "carrier_negotiation": f"Kargo anlaşması: ₺{price:.2f}/kg",
            }
            return labels.get(self.scenario, f"Anlaşma sağlandı: ₺{price:.2f}")
        return f"Müzakere başarısız — {self.scenario} anlaşma sağlanamadı (walk-away)."


# ── Convenience factory functions ──────────────────────────────────────────────

def supplier_rfq(
    *,
    current_cogs: float,
    target_cogs: float,
    floor_price: float,
    style: ConcessionStyle = "moderate",
) -> tuple[NegotiationState, str]:
    """Tedarikçi RFQ senaryosu: COGS hedef altındaysa pazarlık başlat."""
    tmpl = NegotiationTemplate(
        scenario="supplier_rfq",
        context={"current_cogs": current_cogs, "target_cogs": target_cogs, "floor_price": floor_price},
        style=style,
    )
    state = NegotiationProtocol().run(tmpl.build_state())
    return state, tmpl.summary(state)


def influencer_fee_negotiation(
    *,
    budget_per_post: float,
    quoted_fee: float,
    min_acceptable_fee: float,
    style: ConcessionStyle = "moderate",
) -> tuple[NegotiationState, str]:
    """Influencer ücret pazarlığı: kampanya CPA hedefinden sapma varsa fiyatı düşür."""
    tmpl = NegotiationTemplate(
        scenario="influencer_fee",
        context={
            "budget_per_post": budget_per_post,
            "quoted_fee": quoted_fee,
            "min_acceptable_fee": min_acceptable_fee,
        },
        style=style,
    )
    state = NegotiationProtocol().run(tmpl.build_state())
    return state, tmpl.summary(state)


def carrier_negotiation(
    *,
    current_rate_per_kg: float,
    target_rate_per_kg: float,
    floor_rate_per_kg: float,
    style: ConcessionStyle = "aggressive",
) -> tuple[NegotiationState, str]:
    """Kargo şirketi müzakeresi: ort. kargo maliyeti eşiği aştığında devreye girer."""
    tmpl = NegotiationTemplate(
        scenario="carrier_negotiation",
        context={
            "current_rate_per_kg": current_rate_per_kg,
            "target_rate_per_kg": target_rate_per_kg,
            "floor_rate_per_kg": floor_rate_per_kg,
        },
        style=style,
    )
    state = NegotiationProtocol().run(tmpl.build_state())
    return state, tmpl.summary(state)


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
