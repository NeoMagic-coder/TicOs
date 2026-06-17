"""Google Ads live adapter — STUB.

Phase 2 scope:
- Google Ads API v17 via the ``google-ads`` SDK (gRPC); needs an MCC + a
  developer token approval that can take 1-3 weeks.
- OAuth 2.0 web flow → refresh token persisted per merchant.
- GAQL query builder for ``get_campaigns``; mutate operations for budget
  changes wrapped in a single ``Operation`` with partial-failure support.

Credentials needed before live wiring:
- ``GOOGLE_ADS_DEVELOPER_TOKEN``
- ``GOOGLE_ADS_CLIENT_ID`` / ``GOOGLE_ADS_CLIENT_SECRET``
- ``GOOGLE_ADS_REFRESH_TOKEN``
- ``GOOGLE_ADS_LOGIN_CUSTOMER_ID``   (MCC, 10-digit, no dashes)
- ``GOOGLE_ADS_CUSTOMER_ID``         (target account)

Why this isn't live yet: developer token approval is gated on a real
production workload; sandbox lacks update_budget semantics.
"""
from __future__ import annotations

from apps.api.core.logging import get_logger

log = get_logger(__name__)


def register() -> None:
    log.info("live.google_ads.skipped", reason="stub_phase2")
