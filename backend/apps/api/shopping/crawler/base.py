"""Site adaptoru tabani — Playwright listeleme gezgini + LLM fallback.

Her site adaptoru bagimsiz calisir; biri coktugunde digerleri etkilenmez.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import quote_plus

from apps.api.shopping.extraction.dom_extractor import build_offer
from apps.api.shopping.extraction.llm_extractor import extract_offers_llm
from apps.api.shopping.schemas import Offer, ShoppingGoal

_CARD_WAIT_MS = 8000


@dataclass(frozen=True)
class SelectorConfig:
    base_url: str
    search_url: str  # {query} yer tutucusu icerir
    card: str
    title: str
    price: str


@dataclass(frozen=True)
class SiteResult:
    site: str
    offers: list[Offer] = field(default_factory=list)
    error: str | None = None


class SiteAdapter(ABC):
    site_name: str = "base"
    requires_browser: bool = True

    @abstractmethod
    async def fetch_offers(
        self,
        goal: ShoppingGoal,
        *,
        page: Any = None,
        llm: Any = None,
        limit: int = 8,
    ) -> list[Offer]: ...


class PlaywrightListingAdapter(SiteAdapter):
    """Arama sayfasini gezer, kartlari DOM ile cikarir; DOM bos kalirsa LLM'e duser."""

    selectors: SelectorConfig

    async def fetch_offers(
        self,
        goal: ShoppingGoal,
        *,
        page: Any = None,
        llm: Any = None,
        limit: int = 8,
    ) -> list[Offer]:
        if page is None:
            raise RuntimeError(f"{self.site_name}: tarayici sayfasi gerekli")
        url = self.selectors.search_url.format(query=quote_plus(goal.product_query))
        await page.goto(url, wait_until="domcontentloaded")
        offers = await self._extract_dom(page, limit)
        if not offers and llm is not None:
            body_text = await page.locator("body").inner_text()
            offers = await extract_offers_llm(body_text, site=self.site_name, provider=llm)
        return offers[:limit]

    async def _extract_dom(self, page: Any, limit: int) -> list[Offer]:
        cards = page.locator(self.selectors.card)
        try:
            await cards.first.wait_for(timeout=_CARD_WAIT_MS)
        except Exception:
            return []  # kart secicisi eslesmedi -> LLM fallback denenecek
        offers: list[Offer] = []
        count = min(await cards.count(), limit)
        for i in range(count):
            card = cards.nth(i)
            offer = build_offer(
                site=self.site_name,
                title=await self._inner_text(card, self.selectors.title),
                price_text=await self._inner_text(card, self.selectors.price),
                url=await self._href(card),
                context_text=await card.inner_text(),
            )
            if offer is not None:
                offers.append(offer)
        return offers

    async def _inner_text(self, card: Any, selector: str) -> str | None:
        loc = card.locator(selector)
        if await loc.count() == 0:
            return None
        return (await loc.first.inner_text()).strip()

    async def _href(self, card: Any) -> str:
        loc = card.locator("a")
        if await loc.count() == 0:
            return ""
        href = await loc.first.get_attribute("href") or ""
        if not href or href.startswith("http"):
            return href
        return f"{self.selectors.base_url}{href}"

