"""WebSearch adaptoru — CollectAPI + DuckDuckGo ile canli urun aramasi."""

from __future__ import annotations

from typing import Any

from apps.api.shopping.config import Settings, get_settings
from apps.api.shopping.core.web_search import run_product_web_search
from apps.api.shopping.crawler.base import SiteAdapter
from apps.api.shopping.schemas import Offer, ShoppingGoal


class WebSearchAdapter(SiteAdapter):
    site_name = "web_search"
    requires_browser = False

    async def fetch_offers(
        self,
        goal: ShoppingGoal,
        *,
        page: Any = None,
        llm: Any = None,
        limit: int = 8,
    ) -> list[Offer]:
        settings = get_settings()
        sources = _parse_sources(settings.web_search_sources)
        offers, _meta = await run_product_web_search(
            goal.product_query.strip(),
            market_sources=sources,
            limit_per_source=max(2, limit // max(1, len(sources))),
            include_general_web=settings.web_search_general,
        )
        return offers[:limit]


def _parse_sources(raw: str) -> tuple[str, ...]:
    allowed = {"trendyol", "hepsiburada", "n11", "amazon", "gittigidiyor"}
    names = tuple(n for n in (s.strip().casefold() for s in raw.split(",")) if n in allowed)
    return names or ("trendyol", "hepsiburada", "n11")
