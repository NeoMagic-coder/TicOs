"""Meta (Facebook/Instagram) Ads live adapter — STUB.

Phase 2 scope:
- Graph API v19+ endpoints under ``/act_<AD_ACCOUNT_ID>``.
- OAuth: short-lived → long-lived → system-user token refresh path.
- Insight pagination + async report jobs for large date ranges.
- BUC (Business Use Case) rate-limit headers: ``X-Business-Use-Case-Usage``.

Credentials needed before live wiring:
- ``META_AD_ACCOUNT_ID``      (e.g. ``act_1234567890``)
- ``META_ACCESS_TOKEN``       system-user token, never short-lived
- ``META_APP_SECRET``         for ``appsecret_proof`` HMAC

Why this isn't live yet: token-refresh path requires a registered Business
Manager app and verified business; without those, any code here would be
guessed-imitation rather than tested behavior.
"""
from __future__ import annotations

from apps.api.core.logging import get_logger

log = get_logger(__name__)


def register() -> None:
    # Intentional no-op until Phase 2 wires credentials + sandbox tests.
    log.info("live.meta_ads.skipped", reason="stub_phase2")
