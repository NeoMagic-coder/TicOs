"""Site adaptoru kayit defteri — yeni site eklemek icin buraya kaydedin."""

from __future__ import annotations

from apps.api.shopping.crawler.base import SiteAdapter
from apps.api.shopping.crawler.hepsiburada import HepsiburadaAdapter
from apps.api.shopping.crawler.mockstore import MockStoreAdapter
from apps.api.shopping.crawler.trendyol import TrendyolAdapter
from apps.api.shopping.crawler.web_search import WebSearchAdapter

ADAPTERS: dict[str, type[SiteAdapter]] = {
    WebSearchAdapter.site_name: WebSearchAdapter,
    TrendyolAdapter.site_name: TrendyolAdapter,
    HepsiburadaAdapter.site_name: HepsiburadaAdapter,
    MockStoreAdapter.site_name: MockStoreAdapter,
}

