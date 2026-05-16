"""Live (3rd-party) tool adapters.

Each provider module exposes a ``register()`` function that registers its
adapters with the OpenClaw executor via ``register_live_adapter``. The boot
sequence in ``apps.api.main.lifespan`` calls :func:`register_all` once.

Phase 1 (current): only ``shopify`` is fully wired. The rest are intentional
stubs — see the docstrings in each module for what's missing and why.
"""
from __future__ import annotations

from apps.api.core.logging import get_logger
from apps.api.tools.live import (
    google_ads,
    image_fallback,
    klaviyo,
    meta_ads,
    review_aggregator,
    shopify,
)

log = get_logger(__name__)


def register_all() -> None:
    for mod in (shopify, meta_ads, google_ads, klaviyo, review_aggregator, image_fallback):
        try:
            mod.register()
        except Exception as exc:  # one provider must not break the others
            log.warning("live.register_failed", module=mod.__name__, error=str(exc)[:200])
