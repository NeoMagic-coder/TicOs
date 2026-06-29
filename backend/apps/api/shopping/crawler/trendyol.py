"""Trendyol arama adaptoru.

Not: CSS siniflari sik degisir. Seciciler eslesmezse PlaywrightListingAdapter
otomatik olarak LLM cikarimina duser — akis durmaz.
"""

from __future__ import annotations

from apps.api.shopping.crawler.base import PlaywrightListingAdapter, SelectorConfig


class TrendyolAdapter(PlaywrightListingAdapter):
    site_name = "trendyol"
    selectors = SelectorConfig(
        base_url="https://www.trendyol.com",
        search_url="https://www.trendyol.com/sr?q={query}",
        card="div.p-card-wrppr",
        title="span.prdct-desc-cntnr-name",
        price="div.prc-box-dscntd, div.price-item",
    )

