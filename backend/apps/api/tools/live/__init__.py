"""Live (3rd-party) tool adapters.

Each provider module exposes a ``register()`` function that registers its
adapters with the OpenClaw executor via ``register_live_adapter``. The boot
sequence in ``apps.api.main.lifespan`` calls :func:`register_all` once.

Phase 1: shopify + trendyol + ga4 fully wired. Others are intentional stubs.
"""
from __future__ import annotations

import traceback

from apps.api.core.logging import get_logger
from apps.api.tools.live import (
    collectapi,
    competitor_scan,
    compute_tools,
    fakestore,
    ga4,
    google_ads,
    image_analysis,
    image_fallback,
    klaviyo,
    llm_tools,
    meta_ads,
    review_aggregator,
    shopify,
    trendyol,
    web_search,
)

log = get_logger(__name__)


def register_all() -> None:
    for mod in (shopify, trendyol, ga4, fakestore, collectapi, competitor_scan, meta_ads, google_ads, klaviyo, review_aggregator, image_fallback, image_analysis, llm_tools, compute_tools, web_search):
        try:
            mod.register()
        except Exception as exc:  # one provider must not break the others
            log.warning(
                "live.register_failed",
                module=mod.__name__,
                error=str(exc)[:200],
                error_type=type(exc).__name__,
                traceback=traceback.format_exc(),
            )
