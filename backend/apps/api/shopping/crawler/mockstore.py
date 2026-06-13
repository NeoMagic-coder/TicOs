"""MockStore adaptoru — tarayicisiz, deterministik katalog.

Amaclari:
- Testlerin ag/tarayici olmadan calismasi
- Demo modu (AGENT_SITES=mockstore) ile ucu uca akisin gosterilmesi
- Prompttaki 3 test senaryosunu kapsayan veri seti
"""

from __future__ import annotations

from typing import Any

from apps.api.shopping.crawler.base import SiteAdapter
from apps.api.shopping.schemas import Offer, ShoppingGoal

_CATALOG: tuple[Offer, ...] = (
    # --- Senaryo 1 & 3: iPhone 15 ---
    Offer(
        site="mockstore", title="Apple iPhone 15 128 GB", url="https://mockstore.local/iphone-15-128",
        price=39_499, in_stock=True, stock_level=12, delivery_days=1, warranty_months=24, rating=4.7,
    ),
    Offer(
        site="mockstore", title="Apple iPhone 15 128 GB (Kampanya)", url="https://mockstore.local/iphone-15-128-k",
        price=38_999, in_stock=True, stock_level=2, delivery_days=4, warranty_months=24, rating=4.6,
    ),
    Offer(
        site="mockstore", title="Apple iPhone 15 256 GB", url="https://mockstore.local/iphone-15-256",
        price=44_999, in_stock=True, stock_level=8, delivery_days=2, warranty_months=24, rating=4.8,
    ),
    Offer(
        site="mockstore", title="Apple iPhone 15 128 GB", url="https://mockstore.local/iphone-15-out",
        price=37_999, in_stock=False, stock_level=0, delivery_days=None, warranty_months=24, rating=4.5,
    ),
    # --- Senaryo 2: Kulaklik 1000-2000 TL, garanti ---
    Offer(
        site="mockstore", title="Sony WH-CH720N Kulaklik", url="https://mockstore.local/sony-ch720n",
        price=1_799, in_stock=True, stock_level=20, delivery_days=2, warranty_months=24, rating=4.6,
    ),
    Offer(
        site="mockstore", title="JBL Tune 770NC Kulaklik", url="https://mockstore.local/jbl-770nc",
        price=1_499, in_stock=True, stock_level=15, delivery_days=3, warranty_months=None, rating=4.4,
    ),
    Offer(
        site="mockstore", title="Anker Soundcore Q20i Kulaklik", url="https://mockstore.local/anker-q20i",
        price=899, in_stock=True, stock_level=30, delivery_days=1, warranty_months=18, rating=4.3,
    ),
    Offer(
        site="mockstore", title="Bose QuietComfort 45 Kulaklik", url="https://mockstore.local/bose-qc45",
        price=2_499, in_stock=True, stock_level=10, delivery_days=2, warranty_months=24, rating=4.8,
    ),
)


class MockStoreAdapter(SiteAdapter):
    site_name = "mockstore"
    requires_browser = False

    async def fetch_offers(
        self,
        goal: ShoppingGoal,
        *,
        page: Any = None,
        llm: Any = None,
        limit: int = 8,
    ) -> list[Offer]:
        tokens = [t for t in goal.product_query.casefold().split() if t]
        matched = [
            offer.model_copy()
            for offer in _CATALOG
            if all(token in offer.title.casefold() for token in tokens)
        ]
        return matched[:limit]

