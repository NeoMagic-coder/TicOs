"""Hepsiburada arama adaptoru.

Not: data-test-id oznitelikleri sinif adlarindan daha kararlidir ama yine de
degisebilir; eslesme bozulursa LLM fallback devreye girer.
"""

from __future__ import annotations

from apps.api.shopping.crawler.base import PlaywrightListingAdapter, SelectorConfig


class HepsiburadaAdapter(PlaywrightListingAdapter):
    site_name = "hepsiburada"
    selectors = SelectorConfig(
        base_url="https://www.hepsiburada.com",
        search_url="https://www.hepsiburada.com/ara?q={query}",
        card='li[class*="productListContent"], div[class*="productCard"]',
        title='h2[data-test-id="product-card-name"], h3[data-test-id="product-card-name"]',
        price='div[data-test-id="price-current-price"], span[data-test-id="price-current-price"]',
    )

