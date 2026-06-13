"""Karar mekanizmasi — saf skorlama fonksiyonlari.

Kurallar:
- Zorunlu kriterler (butce, stok, hizli teslimat, garanti) FILTRE olarak uygulanir.
- Tercihler agirlikli SKOR olarak uygulanir: fiyat 0.45, stok 0.25, teslimat 0.20, garanti 0.10.
- Fonksiyonlar yan etkisizdir; girdi nesneleri degistirilmez.
"""

from __future__ import annotations

from dataclasses import dataclass

from apps.api.shopping.schemas import Offer, ScoredOffer, ShoppingGoal

LOW_STOCK_THRESHOLD = 3
FAST_DELIVERY_MAX_DAYS = 3


@dataclass(frozen=True)
class ScoreWeights:
    price: float = 0.45
    stock: float = 0.25
    delivery: float = 0.20
    warranty: float = 0.10


def in_budget(offer: Offer, goal: ShoppingGoal) -> bool:
    if goal.budget_min is not None and offer.price < goal.budget_min:
        return False
    if goal.budget_max is not None and offer.price > goal.budget_max:
        return False
    return True


def is_eligible(offer: Offer, goal: ShoppingGoal) -> bool:
    """Zorunlu kriterleri saglamayan teklifler skorlanmadan elenir."""
    if not in_budget(offer, goal):
        return False
    if goal.require_in_stock and not offer.in_stock:
        return False
    if (
        goal.require_fast_delivery
        and offer.delivery_days is not None
        and offer.delivery_days > FAST_DELIVERY_MAX_DAYS
    ):
        return False
    if goal.require_warranty and not offer.warranty_months:
        return False
    return True


def _price_score(price: float, cheapest: float, priciest: float) -> float:
    if priciest <= cheapest:
        return 1.0
    return round((priciest - price) / (priciest - cheapest), 4)


def _stock_score(offer: Offer) -> float:
    if not offer.in_stock:
        return 0.0
    if offer.stock_level is not None and offer.stock_level <= LOW_STOCK_THRESHOLD:
        return 0.6
    return 1.0


def _delivery_score(offer: Offer) -> float:
    if offer.delivery_days is None:
        return 0.4  # bilinmiyor: notr-alti
    if offer.delivery_days <= 1:
        return 1.0
    if offer.delivery_days <= 3:
        return 0.8
    if offer.delivery_days <= 7:
        return 0.5
    return 0.2


def _warranty_score(offer: Offer) -> float:
    if not offer.warranty_months:
        return 0.0
    if offer.warranty_months >= 24:
        return 1.0
    if offer.warranty_months >= 12:
        return 0.8
    return 0.5


def _reasons(offer: Offer, breakdown: dict[str, float]) -> list[str]:
    reasons: list[str] = []
    if breakdown["price"] >= 0.99:
        reasons.append("Adaylar icinde en iyi fiyat.")
    if offer.in_stock and offer.stock_level is not None and offer.stock_level <= LOW_STOCK_THRESHOLD:
        reasons.append(f"Stok az ({offer.stock_level} adet) — hizli karar gerekebilir.")
    if offer.delivery_days is not None and offer.delivery_days <= 1:
        reasons.append("Ertesi gun teslimat.")
    if offer.warranty_months and offer.warranty_months >= 24:
        reasons.append(f"{offer.warranty_months} ay garanti.")
    return reasons


def score_offer(
    offer: Offer,
    *,
    cheapest: float,
    priciest: float,
    weights: ScoreWeights = ScoreWeights(),
) -> ScoredOffer:
    breakdown = {
        "price": _price_score(offer.price, cheapest, priciest),
        "stock": _stock_score(offer),
        "delivery": _delivery_score(offer),
        "warranty": _warranty_score(offer),
    }
    total = round(
        weights.price * breakdown["price"]
        + weights.stock * breakdown["stock"]
        + weights.delivery * breakdown["delivery"]
        + weights.warranty * breakdown["warranty"],
        4,
    )
    return ScoredOffer(offer=offer, score=total, breakdown=breakdown, reasons=_reasons(offer, breakdown))


def rank_offers(
    offers: list[Offer],
    goal: ShoppingGoal,
    weights: ScoreWeights = ScoreWeights(),
) -> list[ScoredOffer]:
    """Filtrele -> skorla -> sirala. Fiyat normalizasyonu uygun adaylar uzerinden yapilir."""
    eligible = [o for o in offers if is_eligible(o, goal)]
    if not eligible:
        return []
    cheapest = min(o.price for o in eligible)
    priciest = max(o.price for o in eligible)
    scored = [
        score_offer(o, cheapest=cheapest, priciest=priciest, weights=weights) for o in eligible
    ]
    return sorted(scored, key=lambda s: (-s.score, s.offer.price))

