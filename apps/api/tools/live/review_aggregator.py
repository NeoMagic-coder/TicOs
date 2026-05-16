"""Review aggregator (Trendyol + Trustpilot) live adapter — STUB.

Phase 2 scope:
- Trendyol Seller Center API: ``/sapigw/suppliers/{id}/products/{barcode}/reviews``.
  Requires seller credentials (Trendyol Marketplace Integration).
- Trustpilot Business API: OAuth 2.0 client_credentials; ``/private/business-units/{id}/reviews``.
- ``analyze_sentiment``: pipe text into the existing ``review_sentiment_analyzer``
  tool (already mock-mode) or a local model — depends on volume.

Credentials needed:
- ``TRENDYOL_SUPPLIER_ID`` / ``TRENDYOL_API_KEY`` / ``TRENDYOL_API_SECRET``
- ``TRUSTPILOT_API_KEY`` / ``TRUSTPILOT_BUSINESS_UNIT_ID``

Why this isn't live yet: Trendyol API is gated to onboarded sellers and the
sandbox doesn't return review-bearing products.
"""
from __future__ import annotations

from apps.api.core.logging import get_logger

log = get_logger(__name__)


def register() -> None:
    log.info("live.review_aggregator.skipped", reason="stub_phase2")
